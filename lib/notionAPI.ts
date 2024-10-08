import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";

import { NUMBER_OF_POSTS_PER_PAGE } from "@/constants/constants";

const notion = new Client({
    auth: process.env.NOTION_TOKEN,
});

const n2m = new NotionToMarkdown({ notionClient: notion });

interface PostMetaData {
    id: string;
    title: string;
    description: string;
    date: string;
    slug: string;
    tags: string[];
}

export const getAllPosts = async (): Promise<PostMetaData[]> => {
    const posts = await notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID || "",
        page_size: 100,
        filter: {
            property: "Published",
            checkbox: {
                equals: true,
            },
        },
        sorts: [
            {
                property: "Date",
                direction: "descending",
            },
        ],
    });

    const allPosts = posts.results.map((result) => getPageMetaData(result as unknown as Post));

    return allPosts;
};

interface Post {
    id: string;
    properties: {
        Title: {
            title: {
                plain_text: string;
            }[];
        };
        Description: {
            rich_text: {
                plain_text: string;
            }[];
        };
        Date: {
            date: {
                start: string;
            };
        };
        Slug: {
            rich_text: {
                plain_text: string;
            }[];
        };
        Tags: {
            multi_select: {
                name: string;
            }[];
        };
    };
}

const getPageMetaData = (post: Post) => {
    const getTags = (tags: { name: string }[]) => {
        const allTags = tags.map((tag: { name: string }) => {
            return tag.name;
        });

        return allTags;
    };

    return {
        id: post.id,
        title: post.properties.Title.title[0].plain_text,
        description: post.properties.Description.rich_text[0].plain_text,
        date: post.properties.Date.date.start,
        slug: post.properties.Slug.rich_text[0].plain_text,
        tags: getTags(post.properties.Tags.multi_select),
    };
};

const isPost = (page: unknown): page is Post => {
    const post = page as Post;
    return (
        post &&
        typeof post.id === "string" &&
        post.properties &&
        post.properties.Title &&
        Array.isArray(post.properties.Title.title) &&
        post.properties.Title.title.length > 0 &&
        typeof post.properties.Title.title[0].plain_text === "string" &&
        post.properties.Description &&
        Array.isArray(post.properties.Description.rich_text) &&
        post.properties.Description.rich_text.length > 0 &&
        typeof post.properties.Description.rich_text[0].plain_text === "string" &&
        post.properties.Date &&
        post.properties.Date.date &&
        typeof post.properties.Date.date.start === "string" &&
        post.properties.Slug &&
        Array.isArray(post.properties.Slug.rich_text) &&
        post.properties.Slug.rich_text.length > 0 &&
        typeof post.properties.Slug.rich_text[0].plain_text === "string" &&
        post.properties.Tags &&
        Array.isArray(post.properties.Tags.multi_select) &&
        post.properties.Tags.multi_select.every((tag) => typeof tag.name === "string")
    );
};

export const getSinglePost = async (slug: string) => {
    const response = await notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID || "",
        filter: {
            property: "Slug",
            formula: {
                string: {
                    equals: slug,
                },
            },
        },
    });

    const page = response.results[0];
    if (!isPost(page)) {
        throw new Error("Page does not match Post interface");
    }
    const metadata = getPageMetaData(page);
    const mdBlocks = await n2m.pageToMarkdown(page.id);
    const mdString = n2m.toMarkdownString(mdBlocks);

    return {
        metadata,
        markdown: mdString,
    };
};

/* Topページ用記事の取得(4) */
export const getPostsForTopPage = async (pageSize: number) => {
    const allPosts = await getAllPosts();
    const displayPosts = allPosts.slice(0, pageSize);

    return displayPosts;
};

/* ページ番号に応じた記事取得 */
export const getPostsByPage = async (page: number) => {
    const allPosts = await getAllPosts();
    const startIndex = (page - 1) * NUMBER_OF_POSTS_PER_PAGE;
    const endIndex = startIndex + NUMBER_OF_POSTS_PER_PAGE;

    return allPosts.slice(startIndex, endIndex);
};

export const getNumberOfPages = async () => {
    const allPosts = await getAllPosts();

    return (
        Math.floor(allPosts.length / NUMBER_OF_POSTS_PER_PAGE) +
        (allPosts.length % NUMBER_OF_POSTS_PER_PAGE > 0 ? 1 : 0)
    );
};

export const getPostsByTagAndPage = async (tagName: string, page: number) => {
    const allPosts = await getAllPosts();
    const posts = allPosts.filter((post) => post.tags.find((tag: string) => tag === tagName));

    const startIndex = (page - 1) * NUMBER_OF_POSTS_PER_PAGE;
    const endIndex = startIndex + NUMBER_OF_POSTS_PER_PAGE;

    return posts.slice(startIndex, endIndex);
};

export const getNumberOfPagesByTag = async (tagName: string) => {
    const allPosts = await getAllPosts();
    const posts = allPosts.filter((post) => post.tags.find((tag: string) => tag === tagName));

    return Math.floor(posts.length / NUMBER_OF_POSTS_PER_PAGE) + (posts.length % NUMBER_OF_POSTS_PER_PAGE > 0 ? 1 : 0);
};

export const getAllTags = async () => {
    const allPosts = await getAllPosts();

    const allTagsDuplicationLists = allPosts.flatMap((post) => post.tags);
    const set = new Set(allTagsDuplicationLists);
    const allTagsList = Array.from(set);

    return allTagsList;
};
