/**
 * Google Maps Actor Implementation
 * Using: compass/crawler-google-places
 */

import { BaseActor } from '../base/BaseActor';
import { IApiClient } from '../../clients/IApiClient';
import { ILogger } from '../../utils/ILogger';

export interface GoogleMapsInput {
  location: string;
  maxResults: number;
  searchStringsArray?: string[];
  language?: string;
  additionalParams?: Record<string, any>;
}

export interface GoogleMapsOutput {
  places: GoogleMapsPlace[];
  metadata: GoogleMapsMetadata;
}

export interface GoogleMapsPlace {
  name: string;
  address: string;
  city: string;
  state: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  rating?: number;
  reviewsCount?: number;
  priceLevel?: number;
  phoneNumber?: string;
  website?: string;
  placeId?: string;
  categories?: string[];
  openingHours?: string[];
  photos?: string[];
}

export interface GoogleMapsMetadata {
  location: string;
  maxResults: number;
  searchStringsArray?: string[];
  language?: string;
  scrapedAt: string;
  totalPlaces: number;
}

export class GoogleMapsActor extends BaseActor<GoogleMapsInput, GoogleMapsOutput> {
  private readonly ACTOR_ID = 'compass/crawler-google-places';

  constructor(apifyClient: IApiClient, logger: ILogger) {
    super(apifyClient, logger);
  }

  public getPlatform(): string {
    return 'google-maps';
  }

  protected getActorId(): string {
    return this.ACTOR_ID;
  }

  protected async validateInput(input: GoogleMapsInput): Promise<void> {
    const errors: string[] = [];

    if (!input.location || input.location.trim().length === 0) {
      errors.push('Location is required');
    }

    if (!input.maxResults || input.maxResults <= 0) {
      errors.push('Max results must be greater than 0');
    }

    // if (input.maxResults > 200) {
    //   errors.push('Max results cannot exceed 200 per request');
    // }

    // Validate searchStringsArray if provided
    if (input.searchStringsArray) {
      if (!Array.isArray(input.searchStringsArray)) {
        errors.push('searchStringsArray must be an array');
      } else if (input.searchStringsArray.length === 0) {
        errors.push('searchStringsArray cannot be empty');
      } else if (input.searchStringsArray.some(item => typeof item !== 'string' || item.trim().length === 0)) {
        errors.push('searchStringsArray must contain only non-empty strings');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }

  protected async executeScraping(input: GoogleMapsInput): Promise<GoogleMapsOutput> {
    const { location, maxResults, searchStringsArray, language } = input;

    this.logger.info(`Starting Google Maps scraping for location: ${location}`, {
      location,
      maxResults,
      searchStringsArray,
      language,
      actorId: this.ACTOR_ID,
    });

    // Build the search query for Google Maps
    const searchQuery = location;

    // Use searchStringsArray from input if provided, otherwise use location as default
    const searchArray = searchStringsArray && searchStringsArray.length > 0 
      ? searchStringsArray 
      : [searchQuery];

    // Construct actor input based on compass/crawler-google-places spec
    const actorInput: Record<string, any> = {
      locationQuery: location,
      maxCrawledPlacesPerSearch: maxResults,
      searchStringsArray: searchArray,
      website: 'withWebsite',
    };

    this.logger.info(`Calling Apify actor ${this.ACTOR_ID}`, {
      actorId: this.ACTOR_ID,
      input: actorInput,
    });

    // Call the Apify actor
    const run = await this.apifyClient.call(this.ACTOR_ID, actorInput);
    
    // Debug: Log run status
    this.logger.info(`Apify run status: ${run.status}`, {
      runId: run.id,
      datasetId: run.defaultDatasetId,
      status: run.status
    });
    
    // If run failed, try to get more details
    if (run.status === 'FAILED') {
      this.logger.error(`Apify run failed for ${this.ACTOR_ID}`, new Error(`Run failed with status: ${run.status}`));
    }
    
    const { items } = await this.apifyClient.listItems(run.defaultDatasetId);

    // Debug: Log raw response from Apify
    this.logger.info(`Received ${items.length} items from Apify actor`, {
      rawItems: JSON.stringify(items).substring(0, 500), // First 500 chars
      datasetId: run.defaultDatasetId,
      runStatus: run.status,
    });

    // Transform the data to our internal format
    const places = this.transformPlaces(items);

    this.logger.info(`Transformed ${places.length} places`, {
      totalInput: items.length,
      totalOutput: places.length,
    });

    return {
      places: places,
      metadata: {
        location,
        maxResults,
        searchStringsArray: searchArray,
        language,
        scrapedAt: new Date().toISOString(),
        totalPlaces: places.length,
      },
    };
  }

  protected transformData(rawData: GoogleMapsOutput): GoogleMapsOutput {
    // Data is already transformed in executeScraping
    return rawData;
  }

  /**
   * Transform Apify output to internal place format
   */
  private transformPlaces(items: any[]): GoogleMapsPlace[] {
    return items.map((item) => this.transformPlace(item)).filter((place) => place !== null);
  }

  private transformPlace(item: any): GoogleMapsPlace | null {
    try {
      // Handle different possible field names from the actor
      const name = item.title || item.name || item.placeName || '';
      
      if (!name) {
        return null;
      }

      return {
        name: name,
        address: item.address || item.formattedAddress || item.fullAddress || '',
        city: item.city ||'',
        state: item.state ||'',
        countryCode: item.countryCode ||'',
        latitude: item.latitude || item.lat || 0,
        longitude: item.longitude || item.lng || item.lon || 0,
        rating: item.rating || item.ratings || undefined,
        reviewsCount: item.reviewsCount || item.numberOfReviews || item.reviews || undefined,
        priceLevel: item.priceLevel || item.price_level || undefined,
        phoneNumber: item.phoneNumber || item.phone || item.telephone || undefined,
        website: item.website || item.url || undefined,
        placeId: item.placeId || item.place_id || item.cid || undefined,
        categories: item.categories || item.types || item.category || undefined,
        openingHours: item.openingHours || item.hours || item.workingHours || undefined,
        photos: item.photos || item.images || undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to transform place item`, error as Error);
      return null;
    }
  }
}
