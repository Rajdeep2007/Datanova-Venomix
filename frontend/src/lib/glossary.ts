// Static concept glossary — zero LLM calls, written once by us.
// When Stage 1 or Stage 3 flags a concept, the frontend pulls the matching entry.

export interface ConceptEntry {
  id: string;
  title: string;
  plain: string;
  analogy: string;
  why_it_matters: string;
  how_we_check: string;
  icon: string;
}

export const GLOSSARY: Record<string, ConceptEntry> = {
  duplicate_rows: {
    id: "duplicate_rows",
    title: "Duplicate Rows",
    icon: "👯",
    plain: "Exact copies of the same row appearing multiple times in the dataset.",
    analogy: "Like receiving the exact same bill in the mail twice. It artificially inflates your counts and skews any analysis.",
    why_it_matters: "Models can overfit on duplicated data, believing it to be a common pattern rather than an artifact of bad data collection.",
    how_we_check: "We look for rows where every single column (excluding known IDs) exactly matches another row.",
  },
  duplicate_columns: {
    id: "duplicate_columns",
    title: "Duplicate Columns",
    icon: "🪞",
    plain: "Two different columns contain the exact same data values for every row.",
    analogy: "Like having a 'Phone Number' column and a 'Mobile' column that are perfectly identical down to the last digit.",
    why_it_matters: "Redundant columns waste memory, slow down training, and can cause severe multicollinearity in linear models.",
    how_we_check: "We run a fast hash check on each column, followed by a strict element-wise comparison to confirm exact matches.",
  },
  constant_features: {
    id: "constant_features",
    title: "Constant Features",
    icon: "🧊",
    plain: "A column where every single non-empty cell has the exact same value.",
    analogy: "Like asking everyone in a room their species. If everyone answers 'Human', the question doesn't help you tell them apart.",
    why_it_matters: "Constant features provide zero predictive power (zero variance). They just take up space and can confuse algorithms trying to find splits.",
    how_we_check: "We count the unique non-null values. If there's only one, it's flagged. If there are missing values alongside the constant, it's a softer warning.",
  },
  infinite_values: {
    id: "infinite_values",
    title: "Infinite Values",
    icon: "♾️",
    plain: "Numeric cells containing Infinity or Negative Infinity instead of an actual number.",
    analogy: "Like dividing a budget by zero. The math breaks and returns an impossible scale.",
    why_it_matters: "Almost all machine learning models will immediately crash if they encounter an infinite value during training.",
    how_we_check: "We scan numeric columns using NumPy's infinity detection (np.isinf) and flag any occurrences.",
  },
  rare_categories: {
    id: "rare_categories",
    title: "Rare Categories",
    icon: "🦄",
    plain: "Categorical values that appear so infrequently they are essentially anomalies.",
    analogy: "Like having a dropdown for 'Country' where 99% are USA/Canada, and one single row says 'Vatican City'.",
    why_it_matters: "Models don't have enough examples to learn anything meaningful about these rare groups, which can lead to overfitting or errors in cross-validation.",
    how_we_check: "We calculate the percentage frequency of each category and flag anything that makes up less than 1% of the column.",
  },
  missingness: {
    id: "missingness",
    title: "Missing Values",
    icon: "🕳️",
    plain:
      "Some cells in this column are empty — the data simply isn't there.",
    analogy:
      "Imagine a survey where 30% of people skipped the income question. You can't just ignore them — they might be the wealthiest or the poorest, and pretending they don't exist skews everything.",
    why_it_matters:
      "Most machine-learning models can't handle blanks at all — they'll crash or silently drop those rows. Even models that tolerate NaNs will produce biased results if the missingness isn't random (e.g., high earners refusing to disclose income).",
    how_we_check:
      "We calculate the percentage of empty cells per column. Columns above 40% missing get flagged because imputation at that scale introduces more noise than signal — dropping the column is often safer.",
  },

  outlier: {
    id: "outlier",
    title: "Outliers",
    icon: "📊",
    plain:
      "A value way outside where most of the data sits.",
    analogy:
      "Like one house on the street listed at 50× the others — probably not a typo, but it'll throw off the neighbourhood average.",
    why_it_matters:
      "Models that average or sum things (linear regression, k-means) get pulled toward extreme values, so a handful of outliers can distort predictions for everyone else. Tree-based models are more robust, but even they can overfit to outliers in small datasets.",
    how_we_check:
      "We use the IQR (Interquartile Range) method: anything below Q1 − 1.5×IQR or above Q3 + 1.5×IQR is flagged. For normally-distributed data, this roughly corresponds to ±2.7 standard deviations.",
  },

  cardinality: {
    id: "cardinality",
    title: "High Cardinality",
    icon: "⚠️",
    plain:
      "This categorical column has a huge number of unique values — almost as many as there are rows.",
    analogy:
      "Imagine trying to group customers by their full street address instead of their city. You'd end up with a group for every single person — no useful pattern.",
    why_it_matters:
      "One-hot encoding a column with 10,000 unique values creates 10,000 new features, most with a single '1'. This causes memory explosions, overfitting, and models that learn to memorise rather than generalise. Columns like IDs, hashes, and free-text names are common offenders.",
    how_we_check:
      "We count unique values and compute the ratio unique_values / total_rows. If that ratio exceeds 0.9 (90% unique), the column is flagged — it's likely an identifier, not a useful feature.",
  },

  multicollinearity: {
    id: "multicollinearity",
    title: "Multicollinearity",
    icon: "🔗",
    plain:
      "Two columns are telling the model almost exactly the same thing.",
    analogy:
      "If you record both 'temperature in Celsius' and 'temperature in Fahrenheit,' you haven't added new information — you've just said the same fact twice in different units. The model gets confused about which one matters.",
    why_it_matters:
      "In linear models, correlated features make coefficient estimates unstable and uninterpretable. A tiny change in the data can flip which feature gets a large weight. Tree-based models handle it better but still waste splits on redundant information.",
    how_we_check:
      "We compute the Pearson correlation coefficient (r) between every pair of numeric columns. Pairs with |r| > 0.85 are flagged — they share over 72% of their variance (r² > 0.72).",
  },

  dtype_mismatch: {
    id: "dtype_mismatch",
    title: "Type Mismatch",
    icon: "🔤",
    plain:
      "This column looks like numbers (or dates), but it's stored as text.",
    analogy:
      "It's like having a spreadsheet where someone typed '42' as text instead of the number 42 — Excel shows it the same way, but formulas break because it's secretly a word, not a value.",
    why_it_matters:
      "A numeric column stored as text can't be used in calculations, correlations, or modelling without conversion. Worse, functions like .mean() will silently skip it or raise errors, giving you incomplete results without warning.",
    how_we_check:
      "We try to coerce each text column to numeric (and to datetime). If more than 90% of the non-null values convert successfully, we flag it as a 'hidden' type that should be cast before analysis.",
  },
  
  // Graph Gallery Concepts
  distribution_numeric: {
    id: "distribution_numeric",
    title: "Numeric Distribution",
    icon: "📊",
    plain: "A combination of a Histogram (top) and a Box Plot (bottom) showing how numeric values are spread out.",
    analogy: "Like looking at a crowd of people grouped by age. The tall bars show the most common age groups, while the box at the bottom highlights where the 'middle 50%' of people sit.",
    why_it_matters: "Models assume certain shapes for your data (like a bell curve). If your data is heavily skewed or has long tails, you might need to apply a log transform so the model can learn effectively.",
    how_we_check: "We bin the numeric values to build the histogram, and calculate the quartiles (Q1, Median, Q3) to draw the box plot. Any dots outside the 'whiskers' are mathematical outliers.",
  },
  distribution_categorical: {
    id: "distribution_categorical",
    title: "Top Categories",
    icon: "📋",
    plain: "A bar chart showing the most frequent text or categorical values in a column.",
    analogy: "Like a leaderboard for a video game. It simply ranks the top 10 most common answers people gave.",
    why_it_matters: "If one category makes up 99% of your data, the column is essentially a 'Constant Feature' and provides no predictive value. If you have thousands of unique categories, you risk 'High Cardinality'.",
    how_we_check: "We count every exact string match in the column, sort them from highest to lowest, and display the top 10.",
  },
  correlation_heatmap: {
    id: "correlation_heatmap",
    title: "Correlation Matrix",
    icon: "🟩",
    plain: "A grid showing how strongly every numeric column relates to every other numeric column.",
    analogy: "Like a giant matchmaking board. Green means two things move together (like height and weight). Red means they move in opposite directions (like car age and price).",
    why_it_matters: "Dark green or dark red squares indicate 'Multicollinearity'. If two features are perfectly correlated, you are feeding the model duplicate information, which can confuse linear algorithms.",
    how_we_check: "We calculate the Pearson correlation coefficient 'r' (from -1 to 1) for every pair. The darker the color, the closer the score is to 1 or -1.",
  },
  scatter_plot: {
    id: "scatter_plot",
    title: "Scatter Plot",
    icon: "📈",
    plain: "A plot showing the relationship between two specific numeric columns by placing a dot for every row.",
    analogy: "Like throwing darts at a board where the horizontal position is your height and vertical is your shoe size. The dots form a visible trend.",
    why_it_matters: "While the correlation heatmap gives you a single number, a scatter plot shows you the *shape* of the relationship. It reveals if a trend is linear, curved, or completely random.",
    how_we_check: "We randomly sample up to 300 points from the dataset (to keep your browser fast) and plot them on an X and Y axis.",
  },
  feature_importance: {
    id: "feature_importance",
    title: "Feature Importance",
    icon: "🎯",
    plain: "A ranking of which columns are the most predictive of your chosen Target variable.",
    analogy: "Like asking a detective which clues were most important in solving a case. The biggest bars are the most crucial pieces of evidence.",
    why_it_matters: "This tells you exactly what drives your target variable. If a feature has a score near 1.0, it might be 'Data Leakage' (e.g., predicting 'Churn' using 'Cancel_Date'). If a feature is 0, it's useless.",
    how_we_check: "We quickly train a miniature Random Forest model in the background on a sample of your data, and ask the model which splits reduced the most error.",
  },
};


// Maps a diagnostic section name to its glossary concept
export const SECTION_CONCEPT_MAP: Record<string, string> = {
  missingness: "missingness",
  outliers: "outlier",
  cardinality: "cardinality",
  correlated_pairs: "multicollinearity",
  dtypes: "dtype_mismatch",
};

// The action enum in human-readable form for the quiz
export const ACTION_LABELS: Record<string, { label: string; description: string }> = {
  impute_median: {
    label: "Impute with Median",
    description: "Fill missing values with the middle value of the column",
  },
  impute_mode: {
    label: "Impute with Mode",
    description: "Fill missing values with the most frequent value",
  },
  drop_column: {
    label: "Drop Column",
    description: "Remove this column from the dataset entirely",
  },
  clip_outliers: {
    label: "Clip Outliers",
    description: "Cap extreme values at the 1st and 99th percentiles",
  },
  log_transform: {
    label: "Log Transform",
    description: "Apply log(1+x) to compress the range and reduce skewness",
  },
  merge_categories: {
    label: "Merge Rare Categories",
    description: "Combine categories with <1% frequency into 'Other'",
  },
  none: {
    label: "Leave As-Is",
    description: "No action needed — this column is fine",
  },
};
