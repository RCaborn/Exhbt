import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { LAB_PATH } from "./lab";

/** A lab screen that hasn't been built yet: one line, and the way back. */
export function Coming({ screen }: { screen: string }) {
  return (
    <main id="main" className="mx-auto flex min-h-[60dvh] max-w-[72rem] items-center justify-center px-4 py-16 sm:px-8">
      <EmptyState
        headingLevel={1}
        title={`${screen}: coming`}
        description="This screen is being built. The kit is ready."
        actions={
          <>
            <Button label="Open the kit" href={`${LAB_PATH}/kit`} variant="primary" />
            <Button label="All screens" href={LAB_PATH} variant="secondary" />
          </>
        }
      />
    </main>
  );
}
