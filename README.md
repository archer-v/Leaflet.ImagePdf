# Leaflet.ImagePdf

Leaflet plugin that creates an jpeg/png image or pdf document of selected map region directly from a browser. 
The image also includes all rendered vector layers, markers, tooltips, images, svg drawing, etc. Size, quality (dpi) and format can be defined in plugin options. 

## Demonstration

[mandalorian-one.github.io/Leaflet.ImagePdf](https://mandalorian-one.github.io/Leaflet.ImagePdf/) 

or clone and run demo locally:

```console
git clone https://github.com/mandalorian-one/Leaflet.ImagePdf.git
cd Leaflet.ImagePdf
./examples/demo.sh
```

## General information

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

Unlike of plugins that rely on browser printing, this plugin generates pdf using jspfd module for pdf generation and dom-to-image module for images. That gives more control and flexibility on content positioning and image quality and makes it different from other plugins which have issues with drawing some layers or scaling limitations.

Since the image generation is performed on a client side, the execution time is depend on client's cpu and memory and also on network bandwith for tile images loading. At this time only Google Chrome and Firefox browsers was tested and supported and there is some issues with safary. Mobile browsers usually have limited resourses in comparison with desktop browsers, especially for creating of high resolution images, so it's better to use desktop browsers for image generation.

You can define "printing" area with LatLngBounds object or any Leaflet geometry object (Polyline, Polygon). 
The plugin covers this area with one, or multiple pages depends on configuration (dpi, page size, etc)

Thanks [Herman Sletmoen](https://github.com/hersle) and his [leaflet-route-print](https://hersle.github.io/leaflet-route-print/) plugin.
It helped me with basic concept and some idea with page calculations and positioning.

This plugin is implemented as UI-less component.
It gives you more flexibility in integration to your application.
You can implement your own UI control or took it from an example (see examples folder), 
that was borrowed from [leaflet-route-print](https://hersle.github.io/leaflet-route-print/) with some refactoring. 
 
The plugin is under development now and api specification is unstable

## Usage

Initalize and configure plugin
```javascript
let imagePdf = L.imagePdf(map, {
//  	.... some options ...
})
```

Describe the area, using L.LatLngBounds or L.polygon or L.polyline objects
```javascript
imagePdf.setArea(L.LatLngBounds([]))
```

### Creating pdf document

Tune some pdf options like page counts, margins, paper size, etc
```javascript
imagePdf.setPageCount(2)   // 2 pages
imagePdf.setPageMargin(10) // mm
```

Show pages preview on the map if needed
```javascript
imagePdf.showPdfPages()
```

Create pdf document
```javascript
imagePdf.createPdf()
```

### Creating jpeg/png image

Tune some image options like image format, etc
```javascript
imagePdf.setImageFormat('jpeg')
```

Show the image area on the map if needed
```javascript
let imageSizeInPixels = 1000;
let areaPaddingInPixels = 10;
let extendToSquareBooleanOption = false;
imagePdf.showImageRegions( imagePdf.calcImages(imageSizeInPixels, areaPaddingInPixels, extendToSquareBooleanOption) )
```

```javascript
imagePdf.createImage(imageSizeInPixels, areaPaddingInPixels, extendToSquareBooleanOption)
```

### Susbscribe to events

```javascript
this.map.once("imagePdf:start", function (data) {
  console.log("started")
})

this.map.once("imagePdf:finish", function (data) {
  console.log("finished")
})

this.map.once("imagePdf:progress", function (data) {
  if (p.operation === "page") {
			console.log(`Creating page ${p.itemNo+1} of ${p.totalItems} ...`);
		}
  if (p.operation === "tile") {
   console.log(`Loaded ${p.itemNo+1} tiles from ${p.totalItems}`);
		}
  if (p.operation === "tile") {
   console.log(`Creating image ${p.itemNo+1} of ${p.totalItems} ...`);
  }
})
```
