# Leaflet-pdf

Leaflet plugin that creates a pdf document or an jpeg/png image of selected map region or leaflet layer directly from the browser. 
A created image also includes all rendered vector layers, markers, tooltips, images, svg drawing, etc. Size, quality (dpi) and format of an image can be defined in plugin options. It makes it different from other plugins which have issues with drawing some layers or scaling limitations.

Pdf features: 
- predefined page sizes (A0-A10, B0-B10, etc) and custom page sizes defined in mm
- landscape and portrait page orientations
- multipaging with automatic page positioning with optimal covering 
- customizable scaling
- cutomizable page padding
- any additional text can be added for every page, including a page number, a total pages, an annotation and some text description

Image features:
- customizable width and height in px
- automatic or custom image scaling
- jpeg / png format is supported

General features:
- the area can be defined as LatLngBounds object, or any leaflet polygon or polyline object
- any layer (raster and vector) can be included or excluded from the result image
- a splash screen and progress bar during image generation
- an events model that allow you to control the process including start and finish and also a progress of tile images loading and image / pdf pages generation

Unlike of plugins that rely on browser printing, this plugin generates pdf using jspfd module for pdf generation and dom-to-image module for images. That gives more control and flexibility on content positioning and image quality. 

Since the image generation is performed on a client side, the execution time is depend on client's cpu and memory and also on network bandwith for tile images loading. At this time google chrome and firefox browsers is supported and there is some issues with safary. Desktop browsers are recomended since mobile browsers usually have limited resourses in comparison with desktop browsers, especially for creating of high resolution images.

You can define "printing" area with LatLngBounds object or any Leaflet geometry object (Polyline, Polygon). 
The plugin covers this area with one, or multiple pages depends on configuration (dpi, page size, etc)

Thanks [Herman Sletmoen](https://github.com/hersle) and his [leaflet-route-print](https://hersle.github.io/leaflet-route-print/) plugin.
It helped me with basic concept and page calculations and positioning.

This plugin is implemented as UI-less component.
It gives you more flexibility in integration to your application 
You can implement your own UI control or took it from an example (see examples folder), 
that was borrowed from [leaflet-route-print](https://hersle.github.io/leaflet-route-print/) with some refactoring. 
 
The plugin is under development now and api specification is unstable

 
