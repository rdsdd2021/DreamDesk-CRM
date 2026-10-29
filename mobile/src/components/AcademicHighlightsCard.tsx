import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../theme/colors";
import { BookOpen } from "lucide-react-native";

interface AcademicHighlightsProps {
  rawAttributes?: Record<string, any>;
}

export function AcademicHighlightsCard({ rawAttributes }: AcademicHighlightsProps) {
  if (!rawAttributes) return null;

  const school = rawAttributes.school;
  const stream = rawAttributes.stream;
  const course = rawAttributes.course;
  const city = rawAttributes.city;
  const score = rawAttributes.score;

  if (!school && !stream && !course && !city && !score) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <BookOpen size={14} color={Colors.primaryLight} />
          <Text style={styles.titleText}>ACADEMIC HIGHLIGHTS</Text>
        </View>
        {score ? (
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>Score: {String(score)}%</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.grid}>
        {school ? (
          <View style={[styles.cell, styles.fullWidthCell]}>
            <Text style={styles.cellLabel}>SCHOOL / COLLEGE</Text>
            <Text style={styles.cellValue}>{String(school)}</Text>
          </View>
        ) : null}

        {stream ? (
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>STREAM</Text>
            <Text style={styles.cellValue}>{String(stream)}</Text>
          </View>
        ) : null}

        {course ? (
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>PREFERRED COURSE</Text>
            <Text style={styles.cellValue}>{String(course)}</Text>
          </View>
        ) : null}

        {city ? (
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>CITY / REGION</Text>
            <Text style={styles.cellValue}>{String(city)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardDark,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  titleText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  scoreBadge: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  scoreText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primaryLight,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cell: {
    flex: 1,
    minWidth: "47%",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  fullWidthCell: {
    minWidth: "100%",
  },
  cellLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  cellValue: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
});
