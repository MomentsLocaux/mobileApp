import React, { useMemo } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { colors } from '@/constants/theme';
import { isAllowedLumiaHref, normalizeLumiaHref } from '@/constants/lumia-deeplinks';

type Segment =
  | { kind: 'text'; text: string; bold: boolean }
  | { kind: 'link'; text: string; href: string };

/**
 * Parse inline markdown used by Lumia: **bold** and [label](/path).
 * Links not on the allowlist are rendered as plain bold-ish text (label only).
 */
export function parseLumiaInlineMarkdown(input: string): Segment[] {
  const segments: Segment[] = [];
  // Match links first, then bold inside remaining runs
  const re = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    if (match.index > last) {
      pushPlain(segments, input.slice(last, match.index));
    }
    if (match[1]) {
      const label = match[2];
      const href = normalizeLumiaHref(match[3]);
      if (href && isAllowedLumiaHref(href)) {
        segments.push({ kind: 'link', text: label, href });
      } else {
        pushPlain(segments, label);
      }
    } else if (match[4]) {
      segments.push({ kind: 'text', text: match[5], bold: true });
    }
    last = match.index + match[0].length;
  }
  if (last < input.length) {
    pushPlain(segments, input.slice(last));
  }
  return segments.length ? segments : [{ kind: 'text', text: input, bold: false }];
}

function pushPlain(segments: Segment[], text: string) {
  if (!text) return;
  // Nested **bold** in leftover plain runs
  const boldRe = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = boldRe.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ kind: 'text', text: text.slice(last, m.index), bold: false });
    }
    segments.push({ kind: 'text', text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    segments.push({ kind: 'text', text: text.slice(last), bold: false });
  }
}

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
  boldStyle?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  onLinkPress?: (href: string) => void;
};

/**
 * Renders Lumia chat text with **bold** and [label](/deeplink).
 */
export function LumiaRichText({ children, style, boldStyle, linkStyle, onLinkPress }: Props) {
  const segments = useMemo(() => parseLumiaInlineMarkdown(children), [children]);

  return (
    <Text style={style}>
      {segments.map((seg, i) => {
        if (seg.kind === 'link') {
          return (
            <Text
              key={i}
              style={[styles.link, linkStyle]}
              onPress={() => onLinkPress?.(seg.href)}
              accessibilityRole="link"
            >
              {seg.text}
            </Text>
          );
        }
        if (seg.bold) {
          return (
            <Text key={i} style={[styles.bold, boldStyle]}>
              {seg.text}
            </Text>
          );
        }
        return <Text key={i}>{seg.text}</Text>;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  link: {
    fontWeight: '700',
    color: colors.brand.secondary,
    textDecorationLine: 'underline',
  },
});
