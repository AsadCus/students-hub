import { defineConfig } from "vitest/config";

// Frontend unit tests (store logic, helpers). Laravel tests run with `php artisan test`.
export default defineConfig({
    esbuild: { loader: "jsx", include: /resources\/js\/.*\.jsx?$/ },
    test: {
        include: ["resources/js/**/*.test.{js,jsx}"],
        environment: "node",
    },
});
