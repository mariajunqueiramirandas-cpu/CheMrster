/** Placeholder until this section is written. */
import { BackBar } from '../ui/Bars.tsx';
import { Page } from '../ui/Page.tsx';
import { Txt } from '../ui/kit.tsx';

export function StudioScreen(_: { initialSmiles?: string }) {
  return (
    <Page header={<BackBar title="Estruturas" />}>
      <Txt>Estruturas</Txt>
    </Page>
  );
}
