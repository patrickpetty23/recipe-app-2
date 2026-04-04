import { View, Text, Image, StyleSheet } from 'react-native';

export default function WalmartProductCard({ product }) {
  if (!product || product.noMatch) {
    return (
      <View style={styles.noMatch}>
        <Text style={styles.noMatchText}>No match found</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {product.thumbnailUrl ? (
        <Image source={{ uri: product.thumbnailUrl }} style={styles.thumb} resizeMode="contain" />
      ) : (
        <View style={styles.thumbPlaceholder} />
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        {product.price != null ? (
          <Text style={styles.price}>${product.price.toFixed(2)}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 52,
    marginRight: 16,
    marginBottom: 10,
    backgroundColor: '#F0F7FF',
    borderRadius: 10,
    padding: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#D0E8FF',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  thumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#DCE8F5',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 12,
    color: '#0D5FA6',
    lineHeight: 17,
    marginBottom: 2,
  },
  price: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0071DC',
  },
  noMatch: {
    marginLeft: 52,
    marginRight: 16,
    marginBottom: 8,
  },
  noMatchText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
});
