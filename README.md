# Leaflet-pdf

Leaflet plugin that creates pdf document from map region directly from the browser. 
The created pdf contains images of selected map region including rendered vector layers, markers, tooltips, images, svg drawing, etc.
It makes it different from other plugins which have issues with drawing some layers or scaling limitations.

Plugin supports: 
- predefined page sizes (A0-A10, B0-B10, etc) and custom page sizes defined in mm
- Landscape and Portrait page orientations
- multipaging with automatic page positioning
- customizable scaling
- any additional text can be added

Unlike of plugins that rely on browser printing, this plugin generates pdf using jspfd module directly in javascript.
That give more control and flexibility on page content and generation.

You can define "printing" area with LatLngBounds object, 
or any Leaflet geometry object (Point, Polyline, Polygon). 
The plugin covers this area with one, or multiple pages depends on 
configuration (dpi, page size, etc)

Thanks [Herman Sletmoen](https://github.com/hersle) and his [leaflet-route-print](https://hersle.github.io/leaflet-route-print/) plugin.
It helped me with basic concept and page calculations and positioning.

This plugin is implemented as UI-less component.
It gives you more flexibility in integration to your application 
You can implement your own UI control or took it from an example (see examples folder), 
that was borrowed from [leaflet-route-print](https://hersle.github.io/leaflet-route-print/) with some refactoring. 

 
The plugin is under development now and api specification is unstable and 
some minor features is buggy and unstable 

 