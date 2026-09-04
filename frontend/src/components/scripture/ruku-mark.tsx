import styles from "./ruku-mark.module.css";

interface RukuMarkProps {
  variant: "positioned" | "floated";
  rukuId: number;
}

export default function RukuMark({ variant, rukuId }: RukuMarkProps) {
  return <span className={styles[variant]}>ع</span>;
}
