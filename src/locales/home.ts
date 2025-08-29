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
    repoLabel: string;
  };
  features: HomeFeature[];
  docs: {
    heading: string;
    blurbBeforeLink: string;
    linkLabel: string;
    blurbAfterLink: string;
  };
  builder?: {
    heading: string;
    qubits: string;
    stateVector: string;
    measurementProbabilities: string;
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
      repoLabel: "Gitee",
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
        description: "Consistent and accessible tutorials that support for live execution.",
      },
    ],
    docs: {
      heading: "Documentation",
      blurbBeforeLink: "Browse tutorials, examples, and API reference in the ",
      linkLabel: "documentation portal",
      blurbAfterLink: ".",
    },
    builder: {
      heading: "Interactive Circuit",
      qubits: "Qubits",
      measurementProbabilities: "Measurement Probabilities",
      stateVector: "State Vector",
    },
  },
  zh: {
    metaDescription: "开源量子计算框架",
    hero: {
      title: "MindQuantum",
      subtitle: "高性能、清晰易用的量子电路构建与模拟，并配备优质文档。",
      startLabel: "开始学习",
      repoLabel: "Gitee",
    },
    features: [
      { title: "高速模拟器", description: "面向科研与教学的一流量子模拟器。" },
      { title: "友好 API", description: "优雅的 Python 接口，配以丰富的文档和示例。" },
      { title: "优秀文档", description: "教程风格统一、可读性好，支持在线运行。" },
    ],
    docs: {
      heading: "文档",
      blurbBeforeLink: "在 ",
      linkLabel: "文档中心",
      blurbAfterLink: " 浏览教程、示例与 API 参考。",
    },
    builder: {
      heading: "交互式电路",
      qubits: "量子比特数",
      measurementProbabilities: "测量概率",
      stateVector: "状态向量",
    },
  },
};
