'use client';

export default function ExecutionIntentImportHeader({
  title,
  titleAs = 'h2',
  titleClassName,
  badgeLabel,
  badgeClassName,
  description,
  descriptionClassName,
  wrapperClassName,
}: {
  title: string;
  titleAs?: 'h2' | 'p';
  titleClassName: string;
  badgeLabel: string;
  badgeClassName: string;
  description: string;
  descriptionClassName: string;
  wrapperClassName?: string;
}) {
  const TitleTag = titleAs;

  return (
    <>
      <div className={wrapperClassName || 'flex flex-wrap items-center gap-2'}>
        <TitleTag className={titleClassName}>{title}</TitleTag>
        <span className={badgeClassName}>{badgeLabel}</span>
      </div>
      <p className={descriptionClassName}>{description}</p>
    </>
  );
}
