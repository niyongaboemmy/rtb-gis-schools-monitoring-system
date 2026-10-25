import { Suspense, useState, type ComponentProps } from "react";
import { lazyPage } from "../lib/lazy";
import type { SchoolForm as SchoolFormComponent } from "./SchoolForm";

const SchoolForm = lazyPage(() =>
  import("./SchoolForm").then((m) => ({ default: m.SchoolForm })),
);

/**
 * `SchoolForm`, downloaded the first time it opens. Its location picker
 * carries the full Rwanda administrative dataset (~4 MB of code), which the
 * pages hosting the form should not pay for on every visit. Once opened it
 * stays mounted, so its close animation still plays.
 */
export function LazySchoolForm(props: ComponentProps<typeof SchoolFormComponent>) {
  const [opened, setOpened] = useState(props.isOpen);
  if (props.isOpen && !opened) setOpened(true);
  if (!opened) return null;
  return (
    <Suspense fallback={null}>
      <SchoolForm {...props} />
    </Suspense>
  );
}
