/** Drama Backend API 基址（WL 自架后端）。 */
export declare const DRAMA_API_BASE: string;
/** Drama Backend API Key（明文；验收后改为加密 / 配置中心）。 */
export declare const DRAMA_API_KEY: string;
/** 生成接口端点（与 WL 适配器对齐）。 */
export declare const DRAMA_ENDPOINTS: {
    readonly txt2image: "/api/v1/generate/txt2image";
    readonly image2image: "/api/v1/generate/image2image";
    readonly uploadimage: "/api/v1/generate/uploadimage";
    readonly videoMsr: "/api/v1/generate/image2videomsr";
    readonly videoMkr: "/api/v1/generate/image2videomkr";
};
/** 宽高比 → 像素尺寸（简化自 WL `config/sizeConfig.ts`）。 */
export declare function sizeForAspectRatio(aspectRatio: string | undefined): {
    width: number;
    height: number;
};
/** 生成一个资产文件名用的 UUID。 */
export declare function newAssetId(): string;
