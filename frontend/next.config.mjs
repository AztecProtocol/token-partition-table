import CopyPlugin from "copy-webpack-plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      child_process: false,
      perf_hooks: false,
    };
    config.plugins.push(
      new CopyPlugin({
        patterns: [
          {
            from: "node_modules/@aztec/bb.js/dest/node/barretenberg_wasm/barretenberg-threads.wasm",
            to: ".",
          },
        ],
      }),
    );
    return config;
  },
};

export default nextConfig;
