/**
 *      Leaflet.ImagePdf <https://github.com/mandalorian-one/Leaflet.ImagePdf>
 *
 *      MIT License http://www.opensource.org/licenses/mit-license.php
 *      Copyright (c) 2023  Alexander Cherviakov, <https://github.com/mandalorian-one/>
 *                          Northern Frontiers Pte Ltd, <https://northernfrontiers.com.fj/>
 *
 **/

/**
 * resizeImage resizes an image to a new size and returns promise with result of canvas.toDataURL
 * @param imageBlob
 * @param newWidth
 * @param newHeight
 * @returns {Promise<unknown>}
 */
export function resizeImage(imageBlob, newWidth, newHeight) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = newWidth;
        canvas.height = newHeight;

        createImageBitmap(imageBlob, {resizeWidth: newWidth, resizeHeight: newHeight, resizeQuality: "high"})
            .then(imageBitmap => {
                ctx.drawImage(imageBitmap, 0, 0)
                resolve(canvas.toDataURL(imageBlob.type,  0.9))
            }).catch( function (er) {
                reject(er)
            })
    });
}

