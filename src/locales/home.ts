import type { Lang } from "../config/i18n";

export type HomeFeature = {
  title: string;
  description: string;
};

export type HomeMessages = {
  metaDescription: string;
  hero: {
    title: string;
    subtitle: string;
    startLabel: string;
    githubLabel: string;
  };
  features: HomeFeature[];
  docs: {
    heading: string;
    blurbBeforeLink: string;
    linkLabel: string;
    blurbAfterLink: string;
  };
};

export const HOME_MESSAGES: Record<Lang, HomeMessages> = {
  en: {
    metaDescription: "Open-source quantum computing framework",
    hero: {
      title: "MindQuantum",
      subtitle:
        "Build and simulate quantum circuits with performance, clarity, and delightful docs.",
      startLabel: "Start Learning",
      githubLabel: "GitHub",
    },
    features: [
      {
        title: "Fast Simulators",
        description: "State-of-the-art simulators for research and education.",
      },
      {
        title: "Friendly APIs",
        description: "Pythonic interfaces with rich documentation and examples.",
      },
      {
        title: "Great Docs",
        description: "Jupyter Book tutorials with consistent, accessible theming.",
      },
    ],
    docs: {
      heading: "Documentation",
      blurbBeforeLink: "Browse tutorials, examples, and API reference in the ",
      linkLabel: "documentation portal",
      blurbAfterLink: ".",
    },
  },
  zh: {
    metaDescription: "开源量子计算框架",
    hero: {
      title: "MindQuantum",
      subtitle: "高性能、清晰易用的量子电路构建与模拟，并配备优质文档。",
      startLabel: "开始学习",
      githubLabel: "GitHub",
    },
    features: [
      { title: "高速模拟器", description: "面向科研与教学的一流量子模拟器。" },
      { title: "友好 API", description: "类 Python 的接口与丰富示例文档。" },
      { title: "优秀文档", description: "基于 Jupyter Book，风格统一、可读性好。" },
    ],
    docs: {
      heading: "文档",
      blurbBeforeLink: "在 ",
      linkLabel: "文档中心",
      blurbAfterLink: " 浏览教程、示例与 API 参考。",
    },
  },
};
