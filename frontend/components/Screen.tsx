import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OfflineBanner } from './OfflineBanner';
import { Colors, Spacing } from '../constants/theme';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  testID?: string;
}

export const Screen: React.FC<Props> = ({ children, scroll = false, padded = true, testID }) => {
  const content = padded ? <View style={{ padding: Spacing.screen, paddingTop: 8 }}>{children}</View> : children;
  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID={testID}>
      <OfflineBanner />
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{content}</View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
});
