import React, { useRef } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Colors, Radius, Typography } from '../constants/theme';

interface Props {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  testID?: string;
}

export const OTPInput: React.FC<Props> = ({ length = 4, value, onChange, testID }) => {
  const refs = useRef<Array<TextInput | null>>([]);

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
          style={[styles.box, value[i] ? styles.filled : null]}
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
    width: 56,
    height: 64,
    marginHorizontal: 6,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  filled: { borderColor: Colors.primary, backgroundColor: '#EFF6FF' },
});
