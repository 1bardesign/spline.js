
# spline.js

A small MIT-licensed library of spline helper functions for javascript in the browser.

An interactive, small (<40kb) demo can be found [here](http://static.1bardesign.com/examples/spline/). It's off-github to avoid pulling the noise library it depends on into this repo, I'll do my best to keep it available indefinitely.

## Pros:

- Smooth line from control points in one line
- Query from nearest points (nearest-on-line and nearest control point)
- Multiple tangent-estimation functions built-in
- Pretty small, ~5k minified without mangling

## Cons:

- uses arrays as 2d vectors -> gc churn
- iterative, not analytical -> "not perfect"

# Examples:

Constructing a spline is easy

```
var points = [
	[10,10],
	[10,90],
	[90,90],
	[90,10]
];

//default parameters
var s = new Spline(points);
```

If you'd like to specify parameters, you can do so at construction time.

```
// (alternative constructions)
//high detail + accuracy, slow, catmull-rom tangents
var s = new Spline(points, 2, 0.01, 32, spline_type_catmull_rom);
//low detail + accuracy, fast, finite-dif tangents
var s = new Spline(points, 10, 0.05, 8, spline_type_finite_dif);
```

Getting a list of "raw" points for rendering the entire spline is a single call, and can be done as a one-liner for throwaway data.

```
//getting points for rendering
var polyline = s.get_points();
//(one-liner version)
// var polyline = new Spline(points).get_points();
```

You can do a few other things with a spline as well, including getting points along it, checking adjacency for arbitrary input points, and getting the nearest control point. The latter can be used to modify the spline using mouse coordinates, for example. Don't forget to recalculate after doing so though!

```
//getting points along the curve
var one_third = s.at(0.333)

//adjacency (along the curve)
var nearest = s.nearest_point([30, 20]);
//adjacency (for modification eg from mouse)
var nearest_ctrl = s.nearest_control_point([30, 20]);
nearest_ctrl[1] += 20;
//needed after we modify control points, before we read from the spline again
s.recalculate();
```

For the full interface, have a scroll through spline.js, it's pretty short and each function is prefaced with a comment explaining what it's for.
