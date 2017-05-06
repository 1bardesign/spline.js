
# spline.js

A small MIT-licensed library of spline helper functions for javascript in the browser.

An interactive, small (<40kb) demo can be found [here](http://static.1bardesign.com/examples/spline/). It's off-github to avoid pulling the noise library it depends on into this repo.

## Pros:

- Smooth line from control points in one line
- Query from nearest points (nearest-on-line and nearest control point)
- Multiple tangent-estimation functions built-in
- Pretty small, ~5k minified without mangling

## Cons:

- uses arrays as 2d vectors -> gc churn
- iterative, not analytical -> "not perfect"

# Example:

```
var points = [
	[10,10],
	[10,90],
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
```

