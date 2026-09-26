// 노트북 3모델 시드 (마스터기획: 1차 출시 카테고리)
import { db } from "./client";
import { categories, productModels } from "./schema";

async function main() {
  const [laptopCategory] = await db
    .insert(categories)
    .values({ name: "노트북", trialEnabled: false })
    .returning();

  await db.insert(productModels).values([
    {
      brand: "Apple",
      modelName: "MacBook Air M2 13인치",
      categoryId: laptopCategory.id,
      canonicalSpec: JSON.stringify({ cpu: "Apple M2", ram: ["8GB", "16GB", "24GB"], storage: ["256GB", "512GB", "1TB"] }),
    },
    {
      brand: "LG",
      modelName: "그램 16 (LG gram 16)",
      categoryId: laptopCategory.id,
      canonicalSpec: JSON.stringify({ cpu: "Intel Core Ultra", ram: ["16GB", "32GB"], storage: ["512GB", "1TB"] }),
    },
    {
      brand: "Samsung",
      modelName: "갤럭시북3 프로 (Galaxy Book3 Pro)",
      categoryId: laptopCategory.id,
      canonicalSpec: JSON.stringify({ cpu: "Intel Core i7", ram: ["16GB"], storage: ["512GB", "1TB"] }),
    },
  ]);

  console.log("시드 완료: 카테고리 1개, 상품모델 3개");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
