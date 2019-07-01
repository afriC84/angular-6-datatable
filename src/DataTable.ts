import {
    Directive, Input, EventEmitter, SimpleChange, OnChanges, DoCheck, IterableDiffers,
    IterableDiffer, Output
} from '@angular/core';
import * as _ from 'lodash';
import { ReplaySubject } from 'rxjs';

export interface SortEvent {
    sortBy: string | string[];
    sortOrder: string
}

export interface PageEvent {
    activePage: number;
    rowsOnPage: number;
    dataLength: number;
}

export interface DataEvent {
    length: number;
}

@Directive({
    selector: 'table[mfData]',
    exportAs: 'mfDataTable'
})
export class DataTable implements OnChanges, DoCheck {

    @Input('mfData') inputData: any[] = [];
    @Input('mfSortBy') sortBy: string | string[] = '';
    @Input('mfSortOrder') sortOrder = 'asc';
    @Input('mfRowsOnPage') rowsOnPage = 1000;
    @Input('mfActivePage') activePage = 1;

    @Output('mfSortByChange') sortByChange = new EventEmitter<string | string[]>();
    @Output('mfSortOrderChange') sortOrderChange = new EventEmitter<string>();

    data: any[];

    onSortChange = new ReplaySubject<SortEvent>(1);
    onPageChange = new EventEmitter<PageEvent>();

    private diff: IterableDiffer<any>;
    private mustRecalculateData = false;

    constructor(private differs: IterableDiffers) {
        this.diff = differs.find([]).create(null);
    }

    getSort(): SortEvent {
        return {sortBy: this.sortBy, sortOrder: this.sortOrder};
    }

    setSort(sortBy: string | string[], sortOrder: string): void {
        if (this.sortBy !== sortBy || this.sortOrder !== sortOrder) {
            this.sortBy = sortBy;
            this.sortOrder = _.includes(['asc', 'desc'], sortOrder) ? sortOrder : 'asc';
            this.mustRecalculateData = true;
            this.onSortChange.next({sortBy: sortBy, sortOrder: sortOrder});
            this.sortByChange.emit(this.sortBy);
            this.sortOrderChange.emit(this.sortOrder);
        }
    }

    getPage(): PageEvent {
        return {activePage: this.activePage, rowsOnPage: this.rowsOnPage, dataLength: this.inputData.length};
    }

    setPage(activePage: number, rowsOnPage: number): void {
        if (this.rowsOnPage !== rowsOnPage || this.activePage !== activePage) {
            this.activePage = this.activePage !== activePage ? activePage : this.calculateNewActivePage(this.rowsOnPage, rowsOnPage);
            this.rowsOnPage = rowsOnPage;
            this.mustRecalculateData = true;
            this.onPageChange.emit({
                activePage: this.activePage,
                rowsOnPage: this.rowsOnPage,
                dataLength: this.inputData ? this.inputData.length : 0
            });
        }
    }

    ngOnChanges(changes: { [key: string]: SimpleChange }): any {
        if (changes['rowsOnPage']) {
            this.rowsOnPage = changes['rowsOnPage'].previousValue;
            this.setPage(this.activePage, changes['rowsOnPage'].currentValue);
            this.mustRecalculateData = true;
        }
        if (changes['sortBy'] || changes['sortOrder']) {
            if (!_.includes(['asc', 'desc'], this.sortOrder)) {
                console.warn('angular2-datatable: value for input mfSortOrder must be one of [\'asc\', \'desc\'], but is:', this.sortOrder);
                this.sortOrder = 'asc';
            }
            if (this.sortBy) {
                this.onSortChange.next({sortBy: this.sortBy, sortOrder: this.sortOrder});
            }
            this.mustRecalculateData = true;
        }
        if (changes['inputData']) {
            this.inputData = changes['inputData'].currentValue || [];
            this.recalculatePage();
            this.mustRecalculateData = true;
        }
    }

    ngDoCheck(): any {
        let changes = this.diff.diff(this.inputData);
        if (changes) {
            this.recalculatePage();
            this.mustRecalculateData = true;
        }
        if (this.mustRecalculateData) {
            this.fillData();
            this.mustRecalculateData = false;
        }
    }

    private calculateNewActivePage(previousRowsOnPage: number, currentRowsOnPage: number): number {
        let firstRowOnPage = (this.activePage - 1) * previousRowsOnPage + 1;
        let newActivePage = Math.ceil(firstRowOnPage / currentRowsOnPage);
        return newActivePage;
    }

    private recalculatePage() {
        let lastPage = Math.ceil(this.inputData.length / this.rowsOnPage);
        this.activePage = lastPage < this.activePage ? lastPage : this.activePage;
        this.activePage = this.activePage || 1;

        this.onPageChange.emit({
            activePage: this.activePage,
            rowsOnPage: this.rowsOnPage,
            dataLength: this.inputData.length
        });
    }

    private fillData(): void {
        let offset = (this.activePage - 1) * this.rowsOnPage;
        let data = this.inputData;
        var sortBy = this.sortBy;
        if (typeof sortBy === 'string' || sortBy instanceof String) {
            data = _.orderBy(data, this.caseInsensitiveIteratee(<string>sortBy), [this.sortOrder]);
        } else {
            data = _.orderBy(data, sortBy, [this.sortOrder]);
        }
        data = _.slice(data, offset, offset + this.rowsOnPage);
        this.data = data;
    }

    private caseInsensitiveIteratee(sortBy: string) {
        return (row: any): any => {
            var value = row;
            for (let sortByProperty of sortBy.split('.')) {
                if (value) {
                    value = value[sortByProperty];
                }
            }
            if (value && typeof value === 'string' || value instanceof String) {
                return value.toLowerCase();
            }
            return value;
        };
    }
}