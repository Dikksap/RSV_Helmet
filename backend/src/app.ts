import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import productsRouter from "./routes/products.js";
import barangRouter from "./routes/barang.js";
import variantProdukRouter from "./routes/variant-produk.js";
import stylesRouter from "./routes/styles.js";
import colorsRouter from "./routes/colors.js";
import sizesRouter from "./routes/sizes.js";
import adminRouter from "./routes/admin.js";
import authRouter from "./routes/auth.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.status(200).json({ message: "API berjalan" });
});

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/products", productsRouter);
app.use("/api/barang", barangRouter);
app.use("/api/variant-produk", variantProdukRouter);
app.use("/api/styles", stylesRouter);
app.use("/api/colors", colorsRouter);
app.use("/api/sizes", sizesRouter);


export default app;
