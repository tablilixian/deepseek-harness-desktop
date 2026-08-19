import type { PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client';
/** Studio root frame props: the standard root shares plus the studio layout face. */
export type StudioFrameProps = PropsRuntime<'root'> & PropsRenderSlots<'conversation' | 'shell.overlay'> & {
    layout: ILayout;
};
/**
 * Three-column studio frame: project list, canvas surface, and the official
 * conversation seat on the right. The sidebar and details seats stay
 * declared (upstream registrants keep their paths) but are not rendered.
 */
export declare function StudioFrame({ renderSlot }: StudioFrameProps): import("react").JSX.Element;
