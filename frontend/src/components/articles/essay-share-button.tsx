"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import ArticleShareButton from "@/components/articles/article-share-button";
import { essayPath, reflectionsPath } from "@/data/articles/nooreimaan";

interface EssayShareButtonProps {
  slug: string;
  title: string;
  urduTitle: string;
}

/**
 * The Share button in the head an essay's pages share. It shares whichever page is showing: the
 * essay's own link on Article, the reflections' link on Reflections, each named for what it is.
 */
export default function EssayShareButton({ slug, title, urduTitle }: EssayShareButtonProps) {
  const onReflections = useSelectedLayoutSegment() === "reflections";
  if (onReflections) {
    return (
      <ArticleShareButton
        path={reflectionsPath(slug)}
        title={`Reflections on ${title}`}
        text={`Noor-e-Imaan | ${urduTitle}\nReflections on ${title}\n`}
        page="reflections"
      />
    );
  }
  return (
    <ArticleShareButton
      path={essayPath(slug)}
      title={title}
      text={`Noor-e-Imaan | ${urduTitle}\n${title}\n`}
      page="essay"
    />
  );
}
