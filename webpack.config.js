const path = require('path')
const UnminifiedWebpackPlugin = require('unminified-webpack-plugin')

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    app: './src/js/Leaflet.ImagePdf.js'
  },
  externals: {
    leaflet: {
      commonjs: 'leaflet',
      amd: 'leaflet',
      root: 'L'
    },
    jspdf: {
      commonjs: 'jspdf',
      amd: 'jspdf'
    }
  },
  plugins: [
    new UnminifiedWebpackPlugin()
  ],
  output: {
    path: path.resolve(__dirname, 'dist/'),
    filename: 'Leaflet.ImagePdf.min.js',
    library: 'leafletpdf',
    hashFunction: 'sha256'
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  'targets': 'defaults'
                }
              ]
            ]
          }
        }
      },
      {
        test: /\.(png|jpe?g|gif|svg|eot|ttf|woff|woff2)$/i,
        loader: 'url-loader',
        options: {
          limit: 8192
        }
      }
    ]
  }
}
