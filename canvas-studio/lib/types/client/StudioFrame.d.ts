import type { InjectFace, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { StudioProjectListInjected } from './contracts.js';
/** Studio root frame props: the standard root shares plus the studio inject face. */
export type StudioFrameProps = PropsRuntime<'root'> & PropsRenderSlots<'conversation' | 'shell.overlay'> & InjectFace<StudioProjectListInjected>;
/**
 * Three-column studio frame: project list, canvas surface + review timeline,
 * and the official conversation seat on the right. The sidebar and details
 * seats stay declared (upstream registrants keep their paths) but are not
 * rendered. The canvas shows every captured node of the selected project
 * (image/video/sticky/text/prompt) with bloodline edges; the timeline lets the
 * user review and jump to any node.
 */
export declare function StudioFrame(props: StudioFrameProps): import("react").JSX.Element;
