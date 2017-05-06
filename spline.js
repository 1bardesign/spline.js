/*
	spline.js

	A small library of spline helper functions for javascript in the browser

	Pros:
		- Smooth line from control points in one line
		- Query from nearest points (nearest-on-line and nearest control point)
		- Multiple tangent-estimation functions built-in
		- Pretty small, ~5k minified without mangling
	Cons:
		- uses arrays as 2d vectors -> gc churn
		- iterative, not analytical -> "not perfect"

	-------------------------------------------------------------------------------
	Example:
	-------------------------------------------------------------------------------

	var points = [
		[10,10],
		[90,10],
		[90,90],
		[90,10]
	];
	//default parameters
	var s = new Spline(points);

	// (alternative constructions)
	//high detail + accuracy, slow, catmull-rom tangents
	// var s = new Spline(points, 2, 0.01, 32, spline_type_catmull_rom);
	//low detail + accuracy, fast, finite-dif tangents
	// var s = new Spline(points, 10, 0.05, 8, spline_type_finite_dif);

	//getting points for rendering
	var polyline = s.get_points();
	//(one-liner version)
	// var polyline = new Spline(points).get_points();

	//getting points along the curve
	var one_third = s.at(0.333)

	//adjacency (along the curve)
	var nearest = s.nearest_point([30, 20]);
	//adjacency (for modification eg from mouse)
	var nearest_ctrl = s.nearest_control_point([30, 20]);
	nearest_ctrl[1] += 20;

	-------------------------------------------------------------------------------
	License:
	-------------------------------------------------------------------------------

	Copyright 2017 Max Cahill

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.

*/

//spline types "enum"
var spline_type_finite_dif = 0;
var spline_type_normalised_dif = 1;
var spline_type_catmull_rom = 2;
var spline_type_linear = 3;

//spline constructor

function Spline(points, step, tolerance, iteration_limit, spline_type) {
	this.points = (points !== undefined ? points : []);
	this.step = (step !== undefined ? step : 3);
	this.tolerance_factor = (tolerance !== undefined ? tolerance : 0.025);
	this.iteration_limit = (iteration_limit !== undefined ? iteration_limit : 20);
	this.spline_type = (spline_type !== undefined ? spline_type : spline_type_normalised_dif);

	//fill out points to minimum length
	while(this.points.length < 2) {
		this.points.push([0,this.points.length]);
	}

	//calculate initial lengths
	this.recalculate();

	return this;
}

//needed after modifications are made to the point coordinates
//for speeding up iteration
Spline.prototype.recalculate = function ()
{
	for(var i = 0; i < this.points.length-1; i++)
	{
		this.points[i][2] = Math.max(1, _v_len_between(this.points[i], this.points[i+1]));
	}
	//note: final point doesn't get a real weight
	//		just something to help avoid index out of bounds
	//		or other errors :)
	this.points[this.points.length - 1][2] = 1;
}

Spline.prototype.index_frac = function(t)
{
	t = Math.max(0, Math.min(t, 1));

	var t_scaled = (this.points.length-1) * t;
	var index = Math.floor(t_scaled);

	var frac = t_scaled - index;

	//return as pair
	return [index, frac];
}

Spline.prototype.tangent_at = function(index) {
	index = _clamp(Math.floor(index), 0, this.points.length-1);
	var pindex = _clamp(index - 1, 0, this.points.length-1);
	var nindex = _clamp(index + 1, 0, this.points.length-1);

	switch(this.spline_type)
	{
		//finite difference
		case spline_type_finite_dif:
		case spline_type_normalised_dif:
		var ppoint = this.points[pindex];
		var point = this.points[index];
		var npoint = this.points[nindex];

		var dif_1 = _v_dif_between(ppoint, point);
		var dif_2 = _v_dif_between(point, npoint);

		var dif = [
			0.5 * (dif_1[0] + dif_2[0]),
			0.5 * (dif_1[1] + dif_2[1])
		];
		if(this.spline_type == spline_type_finite_dif)
		{
			return dif;
		}

		//normalisation to segment length
		var len_1 = _v_len(dif_1);
		var len_2 = _v_len(dif_2);
		var len_d = _v_len(dif)
		dif[0] = (dif[0] / len_d) * (0.5 * (len_1 + len_2));
		dif[1] = (dif[1] / len_d) * (0.5 * (len_1 + len_2));
		return dif;

		//catmull rom
		case spline_type_catmull_rom:
		var ppoint = this.points[pindex];
		var npoint = this.points[nindex];
		return _v_dif_between(ppoint, npoint);

		//no tangent
		case spline_type_linear:
		return [0,0];
	}
}

Spline.prototype.at = function(t)
{
	t = _clamp(t, 0, 1);

	var r = this.index_frac(t);
	var index = r[0];
	var frac = r[1];
	var nindex = Math.min(this.points.length-1, index + 1);

	//grab points
	var p0 = this.points[index];
	var p1 = this.points[nindex];
	//calculate tangents
	var m0 = this.tangent_at(index);
	var m1 = this.tangent_at(nindex);

	//extract components
	var mx_0 = m0[0];
	var my_0 = m0[1];
	var mx_1 = m1[0];
	var my_1 = m1[1];

	var px_0 = p0[0];
	var py_0 = p0[1];
	var px_1 = p1[0];
	var py_1 = p1[1];

	//from here on...
	t = frac

	//calculate factors ahead of time
	var t_squared = t * t;
	var t_cubed = t_squared * t;

	var factor_p0 = (2 * t_cubed - 3 * t_squared + 1);
	var factor_m0 = (t_cubed - 2 * t_squared +t);
	var factor_p1 = (-2 * t_cubed + 3 * t_squared);
	var factor_m1 = (t_cubed - t_squared);

	var px_t = factor_p0 * px_0 + factor_m0 * mx_0 +
				factor_p1 * px_1 + factor_m1 * mx_1;
	var py_t = factor_p0 * py_0 + factor_m0 * my_0 +
				factor_p1 * py_1 + factor_m1 * my_1;

	var weight = p0[2];

	return [px_t, py_t, weight];
}

Spline.prototype.iterate_next_point = function(t)
{
	var prev_t = t;
	var pos = this.at(t);
	var refine = 1;
	var step_taken = 0;
	var step_over = this.step * (1 + this.tolerance_factor);
	var step_under = this.step * (1 - this.tolerance_factor);
	var step_factor = 0.1;

	//this is constant now, as it allows the refinement
	//to "work properly" on weight boundaries
	var weight_factor = pos[2];

	while(refine < this.iteration_limit && (step_taken < step_under || step_taken > step_over))
	{
		var refine_factor = (2.0 / refine);
		var dt = (this.step / weight_factor) * refine_factor * 0.1;
		//not there yet
		if(step_taken < step_under)
		{
			t += dt;
		}
		//overshoot
		else if(step_taken > step_over)
		{
			t -= dt;
			if(t < prev_t)
				t = prev_t + dt / refine;
		}
		var next_pos = this.at(t);
		step_taken = _v_len_between(next_pos, pos);
		//step up the refinement
		refine++;
	}
	return [t, next_pos]
}

Spline.prototype.nearest_control_point_i = function(pos) {
	//get nearest index
	var minimum_distance = 10000000.0;
	var chosen_i = 0;
	for(var i = 0; i < this.points.length; i++)
	{
		var distance = _v_len_between(pos, this.points[i]);
		if(distance < minimum_distance)
		{
			minimum_distance = distance;
			chosen_i = i;
		}
	}
	return chosen_i;
}

Spline.prototype.nearest_control_point = function(pos) {
	return this.points[this.nearest_control_point_i(pos)];
}

Spline.prototype.nearest_t = function(pos) {
	//get nearest index
	var chosen_i = this.nearest_control_point_i(pos);
	var minimum_distance = _v_len_between(pos, this.points[chosen_i]);
	var chosen_t = chosen_i / (this.points.length - 1);
	var step_size = 0.1 / (this.points.length - 1);
	var min_step = 0.00001 / (this.points.length - 1);
	var difference_delta = 1;
	//bisecting search for minimum
	while(step_size > min_step && difference_delta > 0.00001)
	{
		var increase_distance = _v_len_between(pos, this.at(chosen_t + step_size));
		var decrease_distance = _v_len_between(pos, this.at(chosen_t - step_size));
		if(decrease_distance < increase_distance && decrease_distance < minimum_distance)
		{
			chosen_t -= step_size;
			difference_delta = minimum_distance - decrease_distance;
			minimum_distance = decrease_distance
		}
		if(increase_distance < decrease_distance && increase_distance < minimum_distance)
		{
			chosen_t += step_size;
			difference_delta = minimum_distance - increase_distance;
			minimum_distance = increase_distance;
		}
		step_size *= 0.9;
	}
	return chosen_t;
}

Spline.prototype.nearest_point = function(pos) {
	return this.at(this.nearest_t(pos));
}

Spline.prototype.to_points = function() {
	var spline_points = [];
	var t = 0;
	spline_points.push(this.at(0));
	while(t >= 0 && t < 1)
	{
		var res = this.iterate_next_point(t);
		spline_points.push(res[1]);
		t = res[0];
	}
	return spline_points;
}

////////////////////////////////////////////////////////////
//(misc helpers, not for external use)
function _clamp(v, min, max) {
	return Math.max(min, Math.min(v, max));
}

function _v_dif_between(a, b)
{
	return [b[0] - a[0], b[1] - a[1]];
}

function _v_len(v)
{
	return Math.sqrt(v[0] * v[0] + v[1] * v[1])
}

function _v_len_between(a, b)
{
	return _v_len(_v_dif_between(a, b))
}


