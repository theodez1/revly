/**
 * Typography Design System - DISABLED
 * Custom fonts have been removed, using system fonts
 */

import { TextStyle } from 'react-native';

type TypographyStyle = TextStyle & {
  fontSize: number;
  fontWeight: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
};

export const Typography: Record<string, TypographyStyle> = {
    h1: { fontSize: 28, fontWeight: '800' },
    h1Light: { fontSize: 28, fontWeight: '700' },
    h2: { fontSize: 22, fontWeight: '700' },
    h3: { fontSize: 18, fontWeight: '700' },
    h4: { fontSize: 16, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: '400' },
    bodyBold: { fontSize: 16, fontWeight: '600' },
    bodySmall: { fontSize: 14, fontWeight: '400' },
    bodySmallBold: { fontSize: 14, fontWeight: '600' },
    caption: { fontSize: 12, fontWeight: '400' },
    captionBold: { fontSize: 12, fontWeight: '600' },
    button: { fontSize: 16, fontWeight: '700' },
    buttonSmall: { fontSize: 14, fontWeight: '600' },
    stat: { fontSize: 24, fontWeight: '700' },
    statLarge: { fontSize: 32, fontWeight: '800' },
};

export const createTextStyle = (typographyStyle: TypographyStyle, color: string): TextStyle => ({
    ...typographyStyle,
    color,
});

