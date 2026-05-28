import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string(),
        pubDate: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
        heroImage: z.string().optional(),
        category: z.string().optional(),
        author: z.string().optional(),
        order: z.number().optional(),
        /** URL de vídeo a embedar no post (YouTube, Vimeo, ou iframe genérico). */
        videoUrl: z.string().optional(),
        /** Posição do vídeo: 'hero' (substitui imagem) | 'after-hero' (default) | 'inline' (só via shortcode). */
        videoPosition: z.enum(['hero', 'after-hero', 'inline']).optional(),
    }),
});

export const collections = { blog };
