# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 01, section: practice
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

y <- c(2,4,6)
# Translation preserves SD; positive rescaling preserves CV.
summarize <- function(x) {
  c(mean=mean(x),variance=var(x),sd=sd(x),cv_percent=100*sd(x)/mean(x))
}
result <- rbind(original=summarize(y),
                plus_10=summarize(y+10),
                times_10=summarize(10*y))
print(result)
stopifnot(all.equal(unname(result[,"cv_percent"]),c(50,100/7,50)))
