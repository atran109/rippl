import "dotenv/config";
for (const k of ["DATABASE_URL", "REDIS_URL", "JWT_SECRET"]) {
    if (!process.env[k])
        throw new Error(`${k} missing in .env`);
}
export const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    JWT_SECRET: process.env.JWT_SECRET,
};
