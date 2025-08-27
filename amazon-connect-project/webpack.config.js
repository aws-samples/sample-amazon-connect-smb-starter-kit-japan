const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: '[name].bundle.js',
    chunkFilename: '[name].chunk.js',
    clean: {
      keep: /config\.json$/
    }
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html'
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'public')
    },
    port: 3000,
    hot: true
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    alias: {
      '@amazon-connect/contact': require.resolve('@amazon-connect/contact'),
      '@amazon-connect/voice': require.resolve('@amazon-connect/voice'),
      '@amazon-connect/app': require.resolve('@amazon-connect/app')
    }
  },
  optimization: {
    minimize: true,
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 5, // リクエスト数の制限を緩和
      cacheGroups: {
        amazonConnect: {
          test: /[\\/]node_modules[\\/]@amazon-connect/,
          name: 'amazon-connect',
          chunks: 'all',
          priority: 20
        },
	cloudscape: {
	  test: /[\\/]node_modules[\\/]@cloudscape-design[\\/]/,
	  name: 'cloudscape',
	  chunks: 'all',
	  priority: 15
	},
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'amazon-connect-others',
          chunks: 'all',
          priority: 10
        },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true
        }
      }
    }
  },
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development'
};
