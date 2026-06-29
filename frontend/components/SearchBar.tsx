import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Typography } from '../constants/theme';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onFilterPress?: () => void;
  testID?: string;
}

export const SearchBar: React.FC<Props> = ({
  value,
  onChange,
  placeholder = 'Search…',
  onFilterPress,
  testID,
}) => (
  <View style={styles.wrap} testID={testID || 'search-bar'}>
    <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor={Colors.textTertiary}
      value={value}
      onChangeText={onChange}
    />
    {onFilterPress && (
      <TouchableOpacity onPress={onFilterPress} testID="search-filter">
        <Ionicons name="options-outline" size={20} color={Colors.primary} />
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    minHeight: 50,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: { flex: 1, ...Typography.body, color: Colors.textPrimary, marginLeft: 8 },
});
