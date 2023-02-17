
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
            })
    });
}

