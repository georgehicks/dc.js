import {ascending} from 'd3-array';
import {nest} from 'd3-collection';

import {CompositeChart} from './composite-chart';
import {LineChart} from './line-chart';
import {BaseAccessor, ChartGroupType, ChartParentType, CompareFn} from '../core/types';

export type LineChartFunction = (parent, chartGroup) => LineChart;

/**
 * A series chart is a chart that shows multiple series of data overlaid on one chart, where the
 * series is specified in the data. It is a specialization of Composite Chart and inherits all
 * composite features other than recomposing the chart.
 *
 * Examples:
 * - {@link http://dc-js.github.io/dc.js/examples/series.html Series Chart}
 * @mixes CompositeChart
 */
export class SeriesChart extends CompositeChart {
    private _keySort: CompareFn;
    private _charts: {[key: string]: LineChart};
    private _chartFunction: LineChartFunction;
    private _seriesAccessor: BaseAccessor<string>;
    private _seriesSort: CompareFn;
    private _valueSort: CompareFn;

    /**
     * Create a Series Chart.
     * @example
     * // create a series chart under #chart-container1 element using the default global chart group
     * var seriesChart1 = new SeriesChart("#chart-container1");
     * // create a series chart under #chart-container2 element using chart group A
     * var seriesChart2 = new SeriesChart("#chart-container2", "chartGroupA");
     * @param {String|node|d3.selection} parent - Any valid
     * {@link https://github.com/d3/d3-selection/blob/master/README.md#select d3 single selector} specifying
     * a dom block element such as a div; or a dom element or d3 selection.
     * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
     * Interaction with a chart will only trigger events and redraws within the chart's group.
     */
    constructor (parent: ChartParentType, chartGroup: ChartGroupType) {
        super(parent, chartGroup);

        this._keySort = (a, b) => ascending(this._conf.keyAccessor(a), this._conf.keyAccessor(b));

        this._charts = {};
        this._chartFunction = (p, cg) => new LineChart(p, cg);
        this._seriesAccessor = undefined;
        this._seriesSort = ascending;
        this._valueSort = this._keySort;

        this._mandatoryAttributes().push('seriesAccessor', 'chart');
        this.shareColors(true);
    }

    private _compose (subChartArray: LineChart[]): void {
        super.compose(subChartArray);
    }

    public compose (subChartArray): this {
        throw new Error('Not supported for this chart type');
    }

    public _preprocessData () {
        const keep: string[] = [];
        let childrenChanged: boolean;

        // TODO: nest is deprecated, change as per their instructions
        const nester = nest().key(this._seriesAccessor);
        if (this._seriesSort) {
            nester.sortKeys(this._seriesSort);
        }
        if (this._valueSort) {
            nester.sortValues(this._valueSort);
        }
        const nesting = nester.entries(this.data());
        const children =
            nesting.map((sub, i) => {
                const subChart = this._charts[sub.key] || this._chartFunction(this, this.chartGroup());
                if (!this._charts[sub.key]) {
                    childrenChanged = true;
                }
                this._charts[sub.key] = subChart;
                keep.push(sub.key);
                subChart.configure({
                    dimension: this._conf.dimension,
                    keyAccessor: this._conf.keyAccessor,
                    valueAccessor: this._conf.valueAccessor
                })
                return subChart
                    .group({
                        all: typeof sub.values === 'function' ? sub.values : () => sub.values
                    }, sub.key)
                    .brushOn(false);
            });
        // this works around the fact compositeChart doesn't really
        // have a removal interface
        Object.keys(this._charts)
            .filter(c => keep.indexOf(c) === -1)
            .forEach(c => {
                this._clearChart(c);
                childrenChanged = true;
            });
        this._compose(children);
        if (childrenChanged && this.legend()) {
            this.legend().render();
        }
    }

    private _clearChart (c: string): void {
        if (this._charts[c].g()) {
            this._charts[c].g().remove();
        }
        delete this._charts[c];
    }

    private _resetChildren (): void {
        Object.keys(this._charts).map(this._clearChart);
        this._charts = {};
    }

    /**
     * Get or set the chart function, which generates the child charts.
     * @example
     * // put curve on the line charts used for the series
     * chart.chart(function(c) { return new LineChart(c).curve(d3.curveBasis); })
     * // do a scatter series chart
     * chart.chart(anchor => new ScatterPlot(anchor))
     * @param {Function} [chartFunction= (anchor) =>  new LineChart(anchor)]
     * @returns {Function|SeriesChart}
     */
    public chart (): LineChartFunction;
    public chart (chartFunction: LineChartFunction): this;
    public chart (chartFunction?) {
        if (!arguments.length) {
            return this._chartFunction;
        }
        this._chartFunction = chartFunction;
        this._resetChildren();
        return this;
    }

    /**
     * **mandatory**
     *
     * Get or set accessor function for the displayed series. Given a datum, this function
     * should return the series that datum belongs to.
     * @example
     * // simple series accessor
     * chart.seriesAccessor(function(d) { return "Expt: " + d.key[0]; })
     * @param {Function} [accessor]
     * @returns {Function|SeriesChart}
     */
    public seriesAccessor (): BaseAccessor<string>;
    public seriesAccessor (accessor: BaseAccessor<string>): this;
    public seriesAccessor (accessor?) {
        if (!arguments.length) {
            return this._seriesAccessor;
        }
        this._seriesAccessor = accessor;
        this._resetChildren();
        return this;
    }

    /**
     * Get or set a function to sort the list of series by, given series values.
     * @see {@link https://github.com/d3/d3-array/blob/master/README.md#ascending d3.ascending}
     * @see {@link https://github.com/d3/d3-array/blob/master/README.md#descending d3.descending}
     * @example
     * chart.seriesSort(d3.descending);
     * @param {Function} [sortFunction=d3.ascending]
     * @returns {Function|SeriesChart}
     */
    public seriesSort (): CompareFn;
    public seriesSort (sortFunction: CompareFn): this;
    public seriesSort (sortFunction?) {
        if (!arguments.length) {
            return this._seriesSort;
        }
        this._seriesSort = sortFunction;
        this._resetChildren();
        return this;
    }

    /**
     * Get or set a function to sort each series values by. By default this is the key accessor which,
     * for example, will ensure a lineChart series connects its points in increasing key/x order,
     * rather than haphazardly.
     * @see {@link https://github.com/d3/d3-array/blob/master/README.md#ascending d3.ascending}
     * @see {@link https://github.com/d3/d3-array/blob/master/README.md#descending d3.descending}
     * @example
     * // Default value sort
     * _chart.valueSort(function keySort (a, b) {
     *     return d3.ascending(_chart.keyAccessor()(a), _chart.keyAccessor()(b));
     * });
     * @param {Function} [sortFunction]
     * @returns {Function|SeriesChart}
     */
    public valueSort (): CompareFn;
    public valueSort (sortFunction: CompareFn): this;
    public valueSort (sortFunction?) {
        if (!arguments.length) {
            return this._valueSort;
        }
        this._valueSort = sortFunction;
        this._resetChildren();
        return this;
    }

}
