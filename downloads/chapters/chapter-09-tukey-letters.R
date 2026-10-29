# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 09, section: tukey-letters
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

y <- c(8,8,10,12,12, 10,10,12,14,14, 12,12,14,16,16)
group <- factor(rep(c("A","B","C"),each=5))
fit <- aov(y ~ group)
# Simultaneous intervals for the complete pairwise family.
tk <- TukeyHSD(fit, "group", conf.level=.95)
tk
plot(tk)
# Equal-size HSD threshold, verified against the interval output.
qtukey(.95,nmeans=3,df=12)*sqrt(4/5)
