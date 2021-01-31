import { Injectable, InternalServerErrorException } from '@nestjs/common';
import Consola from 'consola';
import ytsr, { ContinueResult, Result } from 'ytsr';
import { SearchFilterDto } from './dto/search-filter.dto';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService {
  async getFilters(searchString: string): Promise<Array<SearchFilterDto>> {
    try {
      const filters = await ytsr.getFilters(searchString);
      const filtersArray = Array.from(filters).map(el => {
        return {
          filterType: el[0],
          filterValues: Array.from(el[1]).map((filterVal: any) => {
            return filterVal[1];
          })
        };
      });
      return filtersArray;
    } catch (err) {
      throw new InternalServerErrorException(`Error getting filters for ${searchString}`);
    }
  }

  async continueSearch(searchContinuation: Array<any>): Promise<ContinueResult> {
    try {
      let continuationArray = searchContinuation;
      if (typeof searchContinuation[2] === 'string') {
        continuationArray = [
          searchContinuation[0],
          searchContinuation[1],
          JSON.parse(searchContinuation[2]),
          JSON.parse(searchContinuation[3])
        ];
        continuationArray[3].limit = Infinity;
      }
      const result = await ytsr.continueReq(continuationArray);
      return result;
    } catch (err) {
      Consola.error(err);
      throw new InternalServerErrorException(`Error continuing search`);
    }
  }

  async doSearch(searchQuery: SearchQueryDto): Promise<Result> {
    let currentFilter = null;
    if (searchQuery.filters && searchQuery.filters.length > 0) {
      for (const filter of searchQuery.filters) {
        const filters = await ytsr.getFilters(currentFilter ? currentFilter.url : searchQuery.q);
        const filterArray = typeof filter === 'string' ? JSON.parse(filter as any) : filter;

        if (!(filterArray.filterName === 'Sort by' && filterArray.filterValue === 'Relevance')) {
          currentFilter = filters.get(filterArray.filterName).get(filterArray.filterValue);
        }
      }
    }

    try {
      if (!searchQuery.pages) {
        searchQuery.pages = 1;
      }
      const searchString = currentFilter ? currentFilter.url : searchQuery.q;
      const result = await ytsr(searchString, searchQuery);
      return result;
    } catch (err) {
      Consola.error(err);
      throw new InternalServerErrorException(`Error searching for ${searchQuery.q}`);
    }
  }
}
