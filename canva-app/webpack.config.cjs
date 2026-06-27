const path = require("node:path");
const webpack = require("webpack");

module.exports = {
  target: "web",
  entry: path.resolve(__dirname, "src/index.tsx"),
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: "ts-loader",
          options: { transpileOnly: true },
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  optimization: {
    splitChunks: false,
    runtimeChunk: false,
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
  ],
  output: {
    filename: "app.js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },
  devtool: "source-map",
  devServer: {
    host: "localhost",
    port: 8080,
    allowedHosts: ["localhost"],
    webSocketServer: false,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Private-Network": "true",
    },
    historyApiFallback: {
      rewrites: [{ from: /^\/$/, to: "/app.js" }],
    },
    setupMiddlewares(middlewares) {
      middlewares.unshift({
        name: "canva-root-bundle",
        middleware(request, _response, next) {
          if (request.url === "/") request.url = "/app.js";
          next();
        },
      });
      return middlewares;
    },
  },
};
