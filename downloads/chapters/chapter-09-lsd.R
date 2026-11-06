# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 09, section: lsd
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

height <- c(9,12,12,15, 13,16,16,19, 17,20,20,23)
group <- factor(rep(c("A","B","C"), each = 4))
model <- aov(height ~ group)
df <- df.residual(model)
mse <- deviance(model) / df
lsd <- qt(.975, df) * sqrt(2*mse/4)
w <- qtukey(.95, 3, df) * sqrt(mse/4)
print(summary(model))
print(c(LSD = lsd, Tukey_W = w))
print(TukeyHSD(model))
stopifnot(lsd < 4, 4 < w, w < 8)
