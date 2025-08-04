module.exports = {
  module: {
    rules: [
      {
        test: /pdf\.worker\.js$/,
        type: 'asset/resource',            // webpack 5
        // OR, for webpack 4:
        // use: { loader: 'file-loader', options: { name: 'static/[name].[hash].[ext]' } }
      },
    ],
  },
};
