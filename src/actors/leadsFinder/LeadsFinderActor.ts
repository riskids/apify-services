/**
 * Leads Finder Actor Implementation
 * Using: code_crafter/leads-finder
 * 
 * This actor finds leads/business contacts based on search criteria.
 * It can search for leads by keyword, location, industry, etc.
 */

import { BaseActor } from '../base/BaseActor';
import { IApiClient } from '../../clients/IApiClient';
import { ILogger } from '../../utils/ILogger';

export interface LeadsFinderInput {
  keywords: string;
  location?: string;
  maxResults?: number;
  industry?: string;
  additionalParams?: Record<string, any>;
}

export interface LeadsFinderOutput {
  leads: Lead[];
  metadata: LeadsFinderMetadata;
}

export interface Lead {
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  location?: string;
  industry?: string;
  companySize?: string;
  source?: string;
}

export interface LeadsFinderMetadata {
  keywords: string;
  location?: string;
  industry?: string;
  maxResults: number;
  scrapedAt: string;
  totalLeads: number;
}

export class LeadsFinderActor extends BaseActor<LeadsFinderInput, LeadsFinderOutput> {
  private readonly ACTOR_ID = 'code_crafter/leads-finder';

  constructor(apifyClient: IApiClient, logger: ILogger) {
    super(apifyClient, logger);
  }

  public getPlatform(): string {
    return 'leads-finder';
  }

  protected getActorId(): string {
    return this.ACTOR_ID;
  }

  protected async validateInput(input: LeadsFinderInput): Promise<void> {
    const errors: string[] = [];

    if (!input.keywords || input.keywords.trim().length === 0) {
      errors.push('Keywords are required');
    }

    if (input.maxResults && input.maxResults <= 0) {
      errors.push('Max results must be greater than 0');
    }

    if (input.maxResults && input.maxResults > 500) {
      errors.push('Max results cannot exceed 500 per request');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }

  protected async executeScraping(input: LeadsFinderInput): Promise<LeadsFinderOutput> {
    const { keywords, location, industry, maxResults } = input;
    const actualMaxResults = maxResults || 100;

    this.logger.info(`Starting Leads Finder scraping`, {
      keywords,
      location,
      industry,
      maxResults: actualMaxResults,
      actorId: this.ACTOR_ID,
    });

    // Build the search query
    let searchQuery = keywords;
    if (location) {
      searchQuery += ` ${location}`;
    }
    if (industry) {
      searchQuery += ` ${industry}`;
    }

    // Construct actor input based on code_crafter/leads-finder spec
    const actorInput: Record<string, any> = {
      search: searchQuery,
      keywords: keywords.split(',').map(k => k.trim()),
      maxResults: actualMaxResults,
      ...input.additionalParams,
    };

    // Add optional parameters
    if (location) {
      actorInput.location = location;
    }
    if (industry) {
      actorInput.industry = industry;
    }

    this.logger.info(`Calling Apify actor ${this.ACTOR_ID}`, {
      actorId: this.ACTOR_ID,
      input: actorInput,
    });

    // Call the Apify actor
    const run = await this.apifyClient.call(this.ACTOR_ID, actorInput);
    const { items } = await this.apifyClient.listItems(run.defaultDatasetId);

    this.logger.info(`Received ${items.length} items from Apify actor`);

    // Transform the data to our internal format
    const leads = this.transformLeads(items);

    this.logger.info(`Transformed ${leads.length} leads`, {
      totalInput: items.length,
      totalOutput: leads.length,
    });

    return {
      leads: leads,
      metadata: {
        keywords,
        location,
        industry,
        maxResults: actualMaxResults,
        scrapedAt: new Date().toISOString(),
        totalLeads: leads.length,
      },
    };
  }

  protected transformData(rawData: LeadsFinderOutput): LeadsFinderOutput {
    // Data is already transformed in executeScraping
    return rawData;
  }

  /**
   * Transform Apify output to internal lead format
   */
  private transformLeads(items: any[]): Lead[] {
    return items.map((item) => this.transformLead(item)).filter((lead) => lead !== null);
  }

  private transformLead(item: any): Lead | null {
    try {
      // Handle different possible field names from the actor
      // The leads-finder actor typically returns person and company info

      // Extract name information
      const firstName = item.firstName || item.first_name || item.firstname || '';
      const lastName = item.lastName || item.last_name || item.lastname || '';
      const fullName = item.name || item.fullName || item.full_name || '';

      return {
        name: fullName || `${firstName} ${lastName}`.trim() || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        title: item.title || item.jobTitle || item.position || item.role || '',
        company: item.company || item.companyName || item.organization || '',
        email: item.email || item.emailAddress || item.emails?.[0] || '',
        phone: item.phone || item.phoneNumber || item.telephone || item.phones?.[0] || '',
        linkedin: item.linkedin || item.linkedinUrl || item.linkedIn || '',
        website: item.website || item.companyWebsite || item.url || '',
        location: item.location || item.city || item.address || '',
        industry: item.industry || item.sector || '',
        companySize: item.companySize || item.employees || item.size || '',
        source: item.source || 'leads-finder',
      };
    } catch (error) {
      this.logger.error(`Failed to transform lead item`, error as Error);
      return null;
    }
  }
}
