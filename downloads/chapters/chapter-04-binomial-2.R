# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 04, section: binomial
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Four distinct units: compare ordered draws and unordered pairs.
units <- c("A","B","C","D")
ordered <- expand.grid(first=units,second=units,stringsAsFactors=FALSE)
without_replacement <- ordered[ordered$first!=ordered$second,]
unordered <- combn(units,2)
print(without_replacement,row.names=FALSE)
print(unordered)
print(c(ordered_without_replacement=nrow(without_replacement),
        unordered_without_replacement=ncol(unordered),
        ordered_with_replacement=nrow(ordered)))
stopifnot(nrow(without_replacement)==12,ncol(unordered)==6,
          nrow(ordered)==16,choose(4,2)==6,factorial(0)==1)
# A binomial coefficient selects success positions, not independent units by itself.
p <- .4
manual_probability <- choose(5,2)*p^2*(1-p)^3
print(c(success_position_sets=choose(5,2),probability=manual_probability))
stopifnot(abs(manual_probability-dbinom(2,5,p))<1e-12)
# Named groups retain their names; only within-group order is discarded.
three_groups_of_three <- choose(9,3)*choose(6,3)
three_groups_of_five <- choose(15,5)*choose(10,5)
five_complete_blocks <- factorial(3)^5
print(c(three_groups_of_three=three_groups_of_three,
        three_groups_of_five=three_groups_of_five,
        five_complete_blocks=five_complete_blocks))
stopifnot(three_groups_of_three==1680,three_groups_of_five==756756,
          five_complete_blocks==7776,
          choose(5,0)==1,choose(5,5)==1)
# These are counts. Probability ratios also require equally likely assignments.
