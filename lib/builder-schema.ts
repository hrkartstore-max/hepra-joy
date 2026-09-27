import {z} from "zod";
export const sectionTypes=["hero","banner","product_grid","categories","text","image","video","testimonials","faq","logo_strip","announcement","newsletter","cta","footer","social_instagram"] as const;
export const sectionSchema=z.object({id:z.string().min(1),type:z.enum(sectionTypes),position:z.number().int().min(0),config:z.record(z.string(),z.unknown())});
export const sectionsSchema=z.array(sectionSchema).max(100);
export type BuilderSection=z.infer<typeof sectionSchema>;