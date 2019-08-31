import * as d3 from 'd3';

import {CompositeChart} from './composite-chart';
import {lineChart} from './line-chart';
import {utils} from '../core/utils';

/**
 * A series chart is a chart that shows multiple series of data overlaid on one chart, where the
 * series is specified in the data. It is a specialization of Composite Chart and inherits all
 * composite features other than recomposing the chart.
 *
 * Examples:
 * - {@link http://dc-js.github.io/dc.js/examples/series.html Series Chart}
 * @class seriesChart
 * @memberof dc
 * @mixes dc.compositeChart
 * @example
 * // create a series chart under #chart-container1 element using the default global chart group
 * var seriesChart1 = dc.seriesChart("#chart-container1");
 * // create a series chart under #chart-container2 element using chart group A
 * var seriesChart2 = dc.seriesChart("#chart-container2", "chartGroupA");
 * @param {String|node|d3.selection} parent - Any valid
 * {@link https://github.com/d3/d3-selection/blob/master/README.md#select d3 single selector} specifying
 * a dom block element such as a div; or a dom element or d3 selection.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {dc.seriesChart}
 */
export class SeriesChart extends CompositeChart {
    constructor (parent, chartGroup) {
        super(parent, chartGroup);

        this._keySort = (a, b) => d3.ascending(this.keyAccessor()(a), this.keyAccessor()(b));

        this._charts = {};
        this._chartFunction = lineChart;
        this._seriesAccessor = undefined;
        this._seriesSort = d3.ascending;
        this._valueSort = this._keySort;

        this._mandatoryAttributes().push('seriesAccessor', 'chart');
        this.shareColors(true);

        // ES6: this function has been overridden, actually defined and called in coordinate grid mixin
        // can not be moved out of the constructor before converting as a member function in the base class
        this._preprocessData = function () {
            const keep = [];
            let childrenChanged;
            const nester = d3.nest().key(this._seriesAccessor);
            if (this._seriesSort) {
                nester.sortKeys(this._seriesSort);
            }
            if (this._valueSort) {
                nester.sortValues(this._valueSort);
            }
            const nesting = nester.entries(this.data());
            const children =
                nesting.map((sub, i) => {
                    const subChart = this._charts[sub.key] || this._chartFunction.call(this, this, chartGroup, sub.key, i);
                    if (!this._charts[sub.key]) {
                        childrenChanged = true;
                    }
                    this._charts[sub.key] = subChart;
                    keep.push(sub.key);
                    return subChart
                        .dimension(this.dimension())
                        .group({
                            all: typeof sub.values === 'function' ? sub.values : utils.constant(sub.values)
                        }, sub.key)
                        .keyAccessor(this.keyAccessor())
                        .valueAccessor(this.valueAccessor())
                        .brushOn(false);
                });
            // ES6: do we add removal function in composite chart?
            // this works around the fact compositeChart doesn't really
            // have a removal interface
            const self = this;
            Object.keys(this._charts)
                .filter(c => keep.indexOf(c) === -1)
                .forEach(c => {
                    self._clearChart(c);
                    childrenChanged = true;
                });
            this._compose(children);
            if (childrenChanged && this.legend()) {
                this.legend().render();
            }
        };

        // ES6: consider creating a method _compose that calls super.compose and make overridden compose to throw exception
        // make compose private
        this._compose = this.compose;
        delete this.compose;
    }

    _clearChart (c) {
        if (this._charts[c].g()) {
            this._charts[c].g().remove();
        }
        delete this._charts[c];
    }

    _resetChildren () {
        Object.keys(this._charts).map(this._clearChart);
        this._charts = {};
    }

    /**
     * Get or set the chart function, which generates the child charts.
     * @method chart
     * @memberof dc.seriesChart
     * @instance
     * @example
     * // put curve on the line charts used for the series
     * chart.chart(function(c) { return dc.lineChart(c).curve(d3.curveBasis); })
     * // do a scatter series chart
     * chart.chart(dc.scatterPlot)
     * @param {Function} [chartFunction=dc.lineChart]
     * @returns {Function|dc.seriesChart}
     */
    chart (chartFunction) {
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
     * @method seriesAccessor
     * @memberof dc.seriesChart
     * @instance
     * @example
     * // simple series accessor
     * chart.seriesAccessor(function(d) { return "Expt: " + d.key[0]; })
     * @param {Function} [accessor]
     * @returns {Function|dc.seriesChart}
     */
    seriesAccessor (accessor) {
        if (!arguments.length) {
            return this._seriesAccessor;
        }
        this._seriesAccessor = accessor;
        this._resetChildren();
        return this;
    }

    /**
     * Get or set a function to sort the list of series by, given series values.
     * @method seriesSort
     * @memberof dc.seriesChart
     * @instance
     * @see {@link https://github.com/d3/d3-array/blob/master/README.md#ascending d3.ascending}
     * @see {@link https://github.com/d3/d3-array/blob/master/README.md#descending d3.descending}
     * @example
     * chart.seriesSort(d3.descending);
     * @param {Function} [sortFunction=d3.ascending]
     * @returns {Function|dc.seriesChart}
     */
    seriesSort (sortFunction) {
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
     * @method valueSort
     * @memberof dc.seriesChart
     * @instance
     * @see {@link https://github.com/d3/d3-array/blob/master/README.md#ascending d3.ascending}
     * @see {@link https://github.com/d3/d3-array/blob/master/README.md#descending d3.descending}
     * @example
     * // Default value sort
     * _chart.valueSort(function keySort (a, b) {
     *     return d3.ascending(_chart.keyAccessor()(a), _chart.keyAccessor()(b));
     * });
     * @param {Function} [sortFunction]
     * @returns {Function|dc.seriesChart}
     */
    valueSort (sortFunction) {
        if (!arguments.length) {
            return this._valueSort;
        }
        this._valueSort = sortFunction;
        this._resetChildren();
        return this;
    }

}

export const seriesChart = (parent, chartGroup) => new SeriesChart(parent, chartGroup);
