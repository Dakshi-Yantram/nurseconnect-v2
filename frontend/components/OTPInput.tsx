import React, { useRef } from 'react';
import { View, TextInput, StyleSheet, useWindowDimensions } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';

interface Props {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  testID?: string;
}

// Boxes were previously a fixed 56x64, which on a 6-digit code overflowed
// narrower phone screens (the last box got clipped off the edge, as seen in
// bug reports). Size them off the actual screen width instead, with the old
// fixed size only as an upper bound on large/tablet screens.
const BOX_MARGIN = 6; // matches the old fixed marginHorizontal below
const MAX_BOX_WIDTH = 56;
const MAX_BOX_HEIGHT = 64;

export const OTPInput: React.FC<Props> = ({ length = 4, value, onChange, testID }) => {
  const refs = useRef<(TextInput | null)[]>([]);
  const { width: screenWidth } = useWindowDimensions();

  // Fit `length` boxes (each with BOX_MARGIN on both sides) inside the
  // screen width minus the surrounding page padding, and never exceed the
  // original fixed size — this is what kept 6-digit codes from overflowing
  // on narrower phones (the box on the far right was being clipped off the
  // edge of the screen).
  const totalMargin = BOX_MARGIN * 2 * length;
  const available = screenWidth - Spacing.lg * 2 - totalMargin;
  const boxWidth = Math.max(36, Math.min(MAX_BOX_WIDTH, Math.floor(available / length)));
  const boxHeight = Math.min(MAX_BOX_HEIGHT, Math.round(boxWidth * 1.15));
  const fontSize = Math.round(boxWidth * 0.42);

  const handleChange = (txt: string, idx: number) => {
    const next = value.split('');
    next[idx] = txt.slice(-1);
    const merged = next.join('').slice(0, length);
    onChange(merged);
    if (txt && idx < length - 1) refs.current[idx + 1]?.focus();
  };

  const handleKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !value[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  };

  return (
    <View style={styles.row} testID={testID || 'otp-input'}>
      {Array.from({ length }).map((_, i) => (
        <TextInput
          key={i}
          ref={(r) => {
            refs.current[i] = r;
          }}
          style={[
            styles.box,
            { width: boxWidth, height: boxHeight, fontSize },
            value[i] ? styles.filled : null,
          ]}
          maxLength={1}
          keyboardType="number-pad"
          value={value[i] || ''}
          onChangeText={(t) => handleChange(t, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          textAlign="center"
          testID={`otp-input-${i}`}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: 4,
  },
  box: {
    marginHorizontal: BOX_MARGIN,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  filled: { borderColor: Colors.primary, backgroundColor: '#EFF6FF' },
});
