/**
 * Interface for API client implementations
 */

export interface RunResult {
  defaultDatasetId: string;
  id: string;
  status: string;
}

export interface Dataset {
  id: string;
  itemCount: number;
}

export interface ItemList {
  items: any[];
  total: number;
  offset: number;
  count: number;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
}

export interface IApiClient {
  /**
   * Execute actor with input
   */
  call(actorId: string, input: any): Promise<RunResult>;

  /**
   * Get dataset by ID
   */
  getDataset(datasetId: string): Promise<Dataset>;

  /**
   * List items from dataset
   */
  listItems(datasetId: string, options?: ListOptions): Promise<ItemList>;
}
