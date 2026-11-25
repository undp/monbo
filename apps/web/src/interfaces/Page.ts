export interface BasePageProps {
  params: Promise<{
    locale: string;
  }>;
}

export interface PageWithSearchParams<T> extends BasePageProps {
  searchParams: Promise<T>;
}

export interface LayoutProps extends BasePageProps {
  children: React.ReactNode;
}
