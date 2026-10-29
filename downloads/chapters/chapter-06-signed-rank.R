# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 06, section: signed-rank
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Construct pairs matching the differences in the worked example.
before <- c(10, 12, 14)
after <- c(7, 13, 16)
difference <- after - before
absolute_ranks <- rank(abs(difference))
c(W_plus=sum(absolute_ranks[difference > 0]),
  W_minus=sum(absolute_ranks[difference < 0]))
# No zero differences or tied absolute differences occur here.
wilcox.test(after, before, paired=TRUE, alternative="two.sided",
            exact=TRUE, correct=FALSE)
