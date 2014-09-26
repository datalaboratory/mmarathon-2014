define(['d3', 'provoda', 'spv', 'libs/simplify', 'libs/veon', './modules/colors', './modules/maphelper', 'jquery'],
function(d3, provoda, spv, simplify, veon, colors, mh, $) {
"use strict";


var place_finishers_at_finish = true;
var SelRunner = function() {};
provoda.View.extendTo(SelRunner, {
	createBase: function() {
		var con = document.createElementNS(mh.SVGNS, 'circle');
		this.c = con;
		this.d3_c = d3.select(con);

		this.d3_c
			.attr("cy", 0)
			.attr("cx", 0)
			.attr("r", 5)
			.style({
				'stroke-width': 2,
				stroke: 'none',
				"fill": 'white'
			});


		var title = document.createElementNS(mh.SVGNS, 'title');
		con.appendChild(title);

		this.d3_title = d3.select(title);
	},
	'compx-ftille': [
		['raw'],
		function(raw) {
			if (!raw) {
				return;
			}
			this.d3_title.text(raw.full_name);
		}
	],
	'compx-fcolor': [
		['raw'],
		function(raw) {
			if (!raw) {
				return;
			}
			this.d3_c.style('stroke', raw.gender === 1 ? 'blue': 'red');
		}
	],

	'compx-pos': [
		['^geodata', '^basedet', '^time_value', '^start_time', 'raw', '^finish_point'],
		function(geodata, basedet, time_value, start_time, raw, finish_point) {
			if ( !(geodata && basedet && start_time && raw && finish_point) ) {
				return;
			}
            var current_distance = mh.getDistanceByRangesAndTime(raw, start_time + time_value * 1000);
			current_distance = Math.max(0, current_distance);
			var geo_coords = mh.getPointAtDistance(
				geodata.geometry.coordinates,
				current_distance
			);

			var px_coords;

			if (geo_coords && !geo_coords.out) {
				px_coords = this.root_view.projection(geo_coords.target);
				
			} else {
				if (place_finishers_at_finish) {
					px_coords = this.root_view.projection(geodata.geometry.coordinates[geodata.geometry.coordinates.length - 1]);
					
				}
			}
			if (!place_finishers_at_finish) {
				if (px_coords) {
					this.d3_c.style('display', 'block');
				} else {
					this.d3_c.style('display', 'none');
				}
			}

			if (px_coords) {
                var _this = this;
				this.d3_c
					.attr("cx", px_coords[0])
					.attr("cy", px_coords[1])

			}
			
			//
		}
	]
});

var RunMapCtr = function() {};
provoda.View.extendTo(RunMapCtr, {
	children_views: {
		selected_runners: SelRunner
	},
	'compx-finish_point': [
		['geodata'],
		function(geodata) {
			var total_distance = d3.geo.length(geodata) * mh.earth_radius;
			return  mh.getPointAtDistance(geodata.geometry.coordinates, total_distance);
		}
	],

	'collch-selected_runners': {
		place: function() {
			return $(this.knodes.single_runners.node());
		}
	},
	
	createBase: function() {

		var svg = document.createElementNS(mh.SVGNS, 'svg');
		this.c = $(svg).css('display', 'none');

		this.svg = d3.select(svg);

        //this.svg = d3.select(map.getPanes().overlayPane).append('svg').attr('width', 1000).attr('height',1000).style('zoom', 1/0.778).style('left',20).append('g')  //для настоящей карты



		this.knodes = {};
		var knodes = this.knodes;

		var main_group = this.svg.append('g');
		knodes.main_group = main_group;

		knodes.base = main_group.append("path");

		knodes.areas_group = main_group.append('g');
		knodes.areas_group.classed("areas_group", true);

		knodes.debug_group = main_group.append('g');
		knodes.single_runners = main_group.append('g');

        knodes.altitude = main_group.append('g');

        svg = document.createElementNS(mh.SVGNS, 'svg');
        $(svg).appendTo($('#alt_graph'));
        this.alt_graph = d3.select(svg)

		this.wch(this, 'vis_con_appended', function(e) {
			if (e.value){
				this.checkSizes();
			}
			this.setVisState('ready', e.value);
			
		});


		this.projection = d3.geo.mercator().scale(1).translate([0, 0]);
		this.root_view.projection = this.projection;

		this.wch(this, 'basedet', function(e) {
			if (e.value){
				this.root_view.promiseStateUpdate('d3map_dets', e.value);
			}
		});

		this.path = d3.geo.path().projection(this.projection);
		this.behavior = d3.behavior.zoom();

		var _this = this;

		// // Костыль: Подгоняем размер после загрузки страницы
		window.setTimeout(spv.debounce(function() {
			_this.checkSizes();
		},100), 0)
		// // /Костыль


		$(window).on('resize', spv.debounce(function() {
			_this.checkSizes();
		},100));


		this.parent_view.c.append(this.c);
		this.setVisState('con_appended', true);

        this.wch(this, 'runners_rate', function(e) {
            this.parent_view.parent_view.promiseStateUpdate('runners_rate', e.value);
        });
		this.wch(this, 'trackwidth', function(e) {
			this.parent_view.parent_view.promiseStateUpdate('trackwidth', e.value);
		});
		this.wch(this, 'trackheight', function(e) {
			this.parent_view.parent_view.promiseStateUpdate('trackheight', e.value);
		});
		this.wch(this, 'track_left_padding', function(e) {
			this.parent_view.parent_view.promiseStateUpdate('track_left_padding', e.value);
		});
		this.wch(this, 'track_top_padding', function(e) {
			this.parent_view.parent_view.promiseStateUpdate('track_top_padding', e.value);
		});
		this.wch(this, 'width', function(e) {
			this.parent_view.parent_view.promiseStateUpdate('mapwidth', e.value);

		});
		this.wch(this, 'height', function(e) {
			this.parent_view.parent_view.promiseStateUpdate('mapheight', e.value);
			this.root_view.promiseStateUpdate('maxwdith', e.value * 1.6);
			this.checkSizes();
			this.root_view.promiseStateUpdate('mapheight', e.value);
		});

        this.wch(this.parent_view.parent_view, 'mapcover-hor', function(e) {
            if (e.value) {
                console.log(e.value)
                this.updateState('mapcover-hor', e.value)
            }
        })
        this.wch(this.parent_view.parent_view, 'mapcover-vert', function(e) {
            if (e.value) {
                this.parent_view.parent_view.promiseStateUpdate('mapcover-vert', e.value)
            }
        })

	},
	earth_radius: mh.earth_radius,
	checkSizes: function() {
		var result = {};
		var container = this.c.parent();

		if (container[0]){
			result.width = container.width();
		}
		result.height = Math.max(window.innerHeight - 80, 580);
		this.updateManyStates(result);
	},
	updateManyStates: function(obj) {
		var changes_list = [];
		for (var name in obj) {
			changes_list.push(name, obj[name]);
		}
		this._updateProxy(changes_list);
	},


	'compx-time_value': {
		depends_on: ['selected_time', 'cvs_data'],
		fn: function(selected_time, cvs_data) {
			if (cvs_data && typeof selected_time != 'undefined'){
				return cvs_data.run_gap * selected_time;
			}
		}
	},
	'compx-genderpaths': {
		depends_on: ['cvs_data'],
		fn: function(cvs_data) {
			if (!cvs_data){
				return;
			}
			this.knodes.age_areas = {};
            this.knodes.areas_group.selectAll('path').remove()

			var array = cvs_data.runners_groups.slice().reverse();
			var _this = this;
			array.forEach(function(el) {
				var grad = _this.parent_view.parent_view.gender_grads[el.gender];
				var color = colors.getGradColor(el.num, 1, el.groups_count, grad);
				_this.knodes.age_areas[ el.key ] = (_this.knodes.areas_group.append('path').style({
					stroke: 'none',
					"fill": color
				}));

			});
		}
	},
	'compx-basepath': {
		depends_on: ['geodata'],
		fn: function(geodata) {
			var rad_distance = d3.geo.length(geodata);
			this.total_distance = rad_distance * this.earth_radius;
			this.knodes.base.data([geodata]);
			return true;
		}
	},
	'compx-bd': {
		depends_on: ['height', 'width', 'vis_ready'],
		fn: function(height, width, vis_ready) {
			if (!height || !width || !vis_ready){
				return;
			}
			var container = this.c.parent();
			container.css('height', height);

			this.width = width;
			this.height = height;
			this.c.css('display', '');
			this.svg.attr({
				width: this.width,
				height: this.height
			});
	
				
			return Date.now();
		}
	},
	'compx-basedet': {
		depends_on: ['geodata', 'bd'],
		fn: function(geodata, bd) {
			if (geodata && bd){
				this.projection.scale(1).translate([0, 0]);
				var b = this.path.bounds(geodata),
					// в s задаётся общий масштаб пары трек-карта
                    width = this.width,
                    height = this.height;
                    var	s = 0.9 / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height)
                    var	t = [(width - s * (b[1][0] + b[0][0])) / 2, (height - s * (b[1][1] + b[0][1])) / 2];

                this.behavior.translate(t).scale(s);

                this.projection.scale(s).translate(t);
				this.updateManyStates({
					scale: 0,
					translate: [0,0]
				});
                this.parent_view.parent_view.path = this.path
				return  this.path.bounds(geodata);
			}
			
		}
	},
	setDot: function(geodata, distance){
		var pp = mh.getPointAtDistance(geodata.geometry.coordinates, distance);
		var pjr = this.projection(pp.target);

	
		this.dot
			.attr("cy", pjr[1])
			.attr("cx", pjr[0]);
	},

	'compx-start_time': [['cvs_data'], function(cvs_data) {

		return cvs_data.start_time;
	}],
	'compx-basepathch':{
		depends_on: ['basedet', 'basepath', 'scale', 'distance_type'],
		fn: function(basedet, basepath, scale, type){
			if (basedet && basepath){
				this.knodes.base.attr("d", this.path)    //рисуем маршрут
				this.knodes.base.projection_key = Date.now() //this.projection.scale() + '_' + this.projection.translate(); // чтобы проекция пересчитывалась при изменении маршрута без изменения масштаба
				return Date.now();
			}
		}
	},
	'compx-runners_rate':{
		depends_on: ['basepathch', 'cvs_data', 'current_runners_data'],
		fn: function(basepathch, cvs_data, current_runners_data){
			if (!basepathch || !cvs_data || !current_runners_data){
				return;
			}
			return mh.getStepHeight(this.knodes, 735, 300, current_runners_data.items, cvs_data.start_time, this.total_distance, 1000);
		}
	},
	'compx-draw': {
		depends_on: ['basepathch', 'cvs_data', 'time_value', 'current_runners_data', 'distance_type'],
		fn: function(basepathch, cvs_data, time_value, current_runners_data, type) {
			if (!basepathch || !cvs_data || typeof time_value == 'undefined' || !current_runners_data){
				return;
			}
            var step = (type == 42) ? 500 : 200;
			var data = mh.getPoints(current_runners_data.runners_groups, this.knodes, time_value, cvs_data.start_time, this.total_distance, step);
			mh.drawRunnersPoints(colors, this.parent_view.parent_view.gender_grads, data, current_runners_data.items, this.knodes.debug_group, time_value, cvs_data.start_time);

			return {};
		}
	},
	'compx-trackbbox': {
		depends_on: ['basepathch'],
		fn: function(basepathch) {
			if (basepathch){
				return this.knodes.base[0][0].getBBox();
			}
		}
	},
	'compx-track_left_padding': {
		depends_on: ['basedet'],
		fn: function(basedet) {
			if (basedet){


				return Math.round(basedet[0][0]);
			}
		}
	},
	'compx-track_top_padding': {
		depends_on: ['basedet'],
		fn: function( basedet) {
			if ( basedet){
				return Math.round(basedet[0][1]);
			}
		}
	},
	'compx-trackwidth': {
		depends_on: ['basedet'],
		fn: function(basedet) {
			if (basedet){

				return Math.round(basedet[1][0] - basedet[0][0]);
			}
		}
	},
	'compx-trackheight': {
		depends_on: ['basedet'],
		fn: function(basedet) {
			if (basedet){

				return Math.round(basedet[1][1] - basedet[0][1]);
			}
		}
	},
	'stch-translate': function(state) {
		var translate_str =  "translate(" + state + ")";
		this.knodes.main_group.attr("transform", translate_str);
		
	},
    'compx-altitudes': {
        depends_on: ['geo_alt'],
            fn: function(geodata) {
            if (!geodata) return
            return geodata.geometry.coordinates.map(function(coord) {
                return coord[2]
            })
        }
    },
    'compx-draw_alt_graph': {
        depends_on: ['altitudes', 'geo_alt'],
            fn: function(alt, geo) {
            if (!alt || !geo) return
            var width = 120, height = 50, offset = 10;
            var svg = this.alt_graph
            svg = svg.attr('width', width + 2 * offset).attr('height', height + 2 * offset)
            svg.selectAll('*').remove()

            var path = svg.append('path')
            var top = svg.append('path')

            var min_max_alt = d3.extent(alt)

            var scaleY = d3.scale.linear()
                .domain(min_max_alt)
                .range([height + offset, offset])
            var scaleX = d3.scale.linear()
                .domain([0, alt.length])
                .range([offset, width + offset])

            var first_point = {x: offset, y: height + offset}
            var data = [first_point]
            var data_top = []
            var max_alt = first_point
            alt.forEach(function(coord, i) {
                var point = {x: scaleX(i), y: scaleY(coord)}
                if (point.y < max_alt.y) {
                    max_alt = point
                    max_alt.num = i + 1
                }
                data.push(point)
                data_top.push(point)
            })
            data.push({x: width + offset, y: height + offset})
            data = mh.formatPathPoints(data) + ' Z'
            data_top = mh.formatPathPoints(data_top)

            path
                .attr('d', data)
                .style({
                    fill: '#eee',
                    stroke: 'none'
                })
            top
                .attr('d', data_top)
                .style({
                    stroke: '#888'
                })
            var alt_line = svg.append('line')
                .attr('x1', max_alt.x)
                .attr('x2', max_alt.x)
                .attr('y1', max_alt.y)
                .attr('y2', height + offset)
                .attr('stroke', '#888')
                .attr('stroke-dasharray', 1)
                .attr('opacity', '.9')

            var alt_text = svg.append('text')
                .text(min_max_alt[1] - min_max_alt[0] + ' м')
                .attr('x', max_alt.x)
                .attr('y', max_alt.y - 1)
                .style('text-anchor', 'middle')

            var top_black_point = svg.append('circle')
                .attr('cx', max_alt.x)
                .attr('cy', max_alt.y)
                .attr('r', 1.5)
            svg
                .append("image")
                .attr("xlink:href", function () {
                    return (locale == 'rus') ? "i/mark-yel.png" : "../i/mark-yel.png"
                })
                .attr("x", scaleX(0) - 5)
                .attr("y", scaleY(alt[0]) - 10)
            svg
                .append("image")
                .attr("xlink:href", function () {
                    return (locale == 'rus') ? "i/mark-red.png" : "../i/mark-red.png"
                })
                .attr("x", scaleX(alt.length) - 5)
                .attr("y", scaleY(alt[alt.length - 1]) - 10)

            svg.selectAll('image')
                .attr("width", 10)
                .attr("height", 10)
            var _this = this
            var point_on_map = this.knodes.altitude.append('circle').attr('r', 2)
            var text_alt_on_map = this.knodes.altitude.append('text').style('text-anchor', 'middle')

            svg.on('mousemove', function() {
                var x = d3.mouse(this)[0]
                var y = scaleY(alt[scaleX.invert(x).toFixed(0)])
                var current_coord_number = Math.round(scaleX.invert(x)).toFixed(0)

                if (current_coord_number > geo.geometry.coordinates.length - 1) {
                    current_coord_number = geo.geometry.coordinates.length - 1
                } else if (current_coord_number < 0) {
                    current_coord_number = 0
                }
                var geo_point_px = _this.projection(geo.geometry.coordinates[current_coord_number])

                point_on_map
                    .attr('cx', geo_point_px[0])
                    .attr('cy', geo_point_px[1])
                text_alt_on_map
                    .text(alt[current_coord_number] + ' м')
                    .attr('x', geo_point_px[0])
                    .attr('y', geo_point_px[1] - 6)
                if (x > offset && x < width + offset) {
                    alt_line
                        .attr('x1', x)
                        .attr('x2', x)
                        .attr('y1', y)
                    top_black_point
                        .attr('cx', x)
                        .attr('cy', y)
                }
                alt_text.style('opacity', 0)
                point_on_map.style('opacity', 1)
                text_alt_on_map.style('opacity', 1)
            })

            svg.on('mouseleave', function() {
                alt_line
                    .attr('x1', max_alt.x)
                    .attr('x2', max_alt.x)
                    .attr('y1', max_alt.y)
                top_black_point
                    .attr('cx', max_alt.x)
                    .attr('cy', max_alt.y)
                alt_text.style('opacity', 1)
                point_on_map.style('opacity', 0)
                text_alt_on_map.style('opacity', 0)
            })
        }
    }
});

return RunMapCtr;
});